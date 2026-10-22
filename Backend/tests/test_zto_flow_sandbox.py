from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.api.v1.auth.schemas import SignupCompleteRequest
from app.application.kyc.errors import KycError
from app.application.kyc.zto.constants import (
    BANK_CONSENT_TEMPLATE,
    CUSTOMER_CONSENT_TEMPLATE,
    FETCH_DUPLICATE,
    PURPOSE_BANK_LOOKUP,
    PURPOSE_CUSTOMER_LOOKUP,
)
from app.application.kyc.zto.crypto import decrypt_lookup_payload
from app.application.kyc.zto.flow_service import (
    get_flow_status,
    handle_signup_zto,
    record_consents,
    start_lookups,
)
from app.application.kyc.zto.phase import ZtoPhase, resolve_zto_phase
from app.application.kyc.zto.prefill_service import get_approved_prefill
from app.application.kyc.zto.review_service import accept_review, build_review_data, decline_review
from app.application.kyc.zto.sandbox import (
    SANDBOX_BANK_ACCOUNT_NUMBER,
    SANDBOX_DOB,
    SANDBOX_IFSC,
    SANDBOX_PAN,
    SandboxZtoLookupClient,
)
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.zto_models import (
    ZtoApprovedProfile,
    ZtoConsentRecord,
    ZtoLookupFetch,
    ZtoPhoneRegistry,
)


@pytest.fixture
def zto_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ZTO_ENABLED", "true")
    monkeypatch.setenv("ZTO_MODE", "sandbox")
    monkeypatch.setenv("ZTO_POLL_INTERVAL_MS", "0")
    get_settings.cache_clear()
    return get_settings()


async def _user(db_session, *, phone: str | None = None) -> User:
    user = User(
        id=uuid4(),
        email=f"zto-{uuid4()}@example.com",
        phone=phone or f"9{uuid4().int % 10**9:09d}",
        phone_verified_at=datetime.now(timezone.utc),
        first_name="Asha",
        last_name="Verma",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _signup_flow(db_session, user: User, settings, **kwargs):
    return await handle_signup_zto(
        db_session,
        user=user,
        first_name="Asha",
        middle_name=None,
        last_name="Verma",
        bank_consent=True,
        customer_consent=True,
        ip="203.0.113.7",
        settings=settings,
        **kwargs,
    )


def _signup_payload(**overrides) -> dict:
    return {
        "signup_token": "token",
        "first_name": "Asha",
        "last_name": "Verma",
        "device_fingerprint": "fingerprint-1234",
        **overrides,
    }


def test_signup_request_requires_both_or_neither_zto_consent() -> None:
    SignupCompleteRequest(**_signup_payload())
    SignupCompleteRequest(**_signup_payload(zto_bank_consent=True, zto_customer_consent=True))
    with pytest.raises(ValidationError):
        SignupCompleteRequest(**_signup_payload(zto_bank_consent=True))
    with pytest.raises(ValidationError):
        SignupCompleteRequest(**_signup_payload(zto_customer_consent=True))


@pytest.mark.asyncio
async def test_signup_without_consents_skips_zto(db_session, zto_settings) -> None:
    user = await _user(db_session)
    flow = await handle_signup_zto(
        db_session,
        user=user,
        first_name="Asha",
        middle_name=None,
        last_name="Verma",
        bank_consent=False,
        customer_consent=False,
        ip=None,
        settings=zto_settings,
    )
    assert flow is None
    assert await resolve_zto_phase(db_session, user.id, settings=zto_settings) == ZtoPhase.NOT_STARTED
    consents = (await db_session.execute(select(ZtoConsentRecord).where(ZtoConsentRecord.user_id == user.id))).all()
    assert consents == []


@pytest.mark.asyncio
async def test_signup_records_consents_and_runs_sandbox_lookups(db_session, zto_settings) -> None:
    user = await _user(db_session)
    flow = await _signup_flow(db_session, user, zto_settings)

    assert flow is not None
    assert flow.signup_display_name == "Asha Verma"
    assert flow.phase == ZtoPhase.REVIEW_PENDING.value

    consents = {
        row.purpose: row
        for row in (
            await db_session.execute(select(ZtoConsentRecord).where(ZtoConsentRecord.user_id == user.id))
        ).scalars()
    }
    assert set(consents) == {PURPOSE_BANK_LOOKUP, PURPOSE_CUSTOMER_LOOKUP}
    assert consents[PURPOSE_BANK_LOOKUP].text == BANK_CONSENT_TEMPLATE.replace("<partner>", "Zynd")
    assert consents[PURPOSE_CUSTOMER_LOOKUP].text == CUSTOMER_CONSENT_TEMPLATE.replace("<partner>", "Zynd")
    assert all(row.ip_address == "203.0.113.7" and row.mode == "checkbox" for row in consents.values())

    fetches = {
        row.kind: row
        for row in (
            await db_session.execute(select(ZtoLookupFetch).where(ZtoLookupFetch.user_id == user.id))
        ).scalars()
    }
    assert set(fetches) == {"bank", "customer"}
    for fetch in fetches.values():
        assert fetch.status == "success"
        assert fetch.payload_encrypted and "HDFC" not in fetch.payload_encrypted
    bank_payload = decrypt_lookup_payload("bank", fetches["bank"].payload_encrypted, fetches["bank"].key_version)
    assert bank_payload["data"]["bank_accounts"][0]["account_number"] == SANDBOX_BANK_ACCOUNT_NUMBER

    registry = (await db_session.execute(select(ZtoPhoneRegistry).where(ZtoPhoneRegistry.user_id == user.id))).scalars().all()
    assert {row.lookup_kind for row in registry} == {"bank", "customer"}
    assert next(r for r in registry if r.lookup_kind == "bank").normalized_name is None
    assert next(r for r in registry if r.lookup_kind == "customer").normalized_name == "asha verma"

    status = await get_flow_status(db_session, user_id=user.id, settings=zto_settings)
    assert status["phase"] == "REVIEW_PENDING"
    assert status["review_required"] is True


@pytest.mark.asyncio
async def test_start_lookups_requires_consents(db_session, zto_settings) -> None:
    user = await _user(db_session)
    with pytest.raises(KycError) as exc:
        await start_lookups(db_session, user=user, name_override="Asha Verma", settings=zto_settings)
    assert exc.value.code == "zto_consent_required"

    await record_consents(db_session, user_id=user.id, ip=None, settings=zto_settings)
    flow = await start_lookups(db_session, user=user, name_override="Asha Verma", settings=zto_settings)
    assert flow.phase == ZtoPhase.REVIEW_PENDING.value


@pytest.mark.asyncio
async def test_start_lookups_requires_verified_phone(db_session, zto_settings) -> None:
    user = await _user(db_session)
    user.phone_verified_at = None
    await record_consents(db_session, user_id=user.id, ip=None, settings=zto_settings)
    with pytest.raises(KycError) as exc:
        await start_lookups(db_session, user=user, name_override="Asha Verma", settings=zto_settings)
    assert exc.value.code == "zto_phone_not_verified"


@pytest.mark.asyncio
async def test_review_data_then_accept_unchanged_has_no_edit_flags(db_session, zto_settings) -> None:
    user = await _user(db_session)
    await _signup_flow(db_session, user, zto_settings)

    review = await build_review_data(db_session, user=user, settings=zto_settings)
    assert review["review_required"] is True
    fields = review["fields"]
    assert fields["name"] == "Asha Verma"
    assert fields["pan"] == SANDBOX_PAN
    assert fields["date_of_birth"] == SANDBOX_DOB
    assert fields["bank_account_number"] == SANDBOX_BANK_ACCOUNT_NUMBER
    assert fields["ifsc_code"] == SANDBOX_IFSC
    assert fields["address_line_1"] == "221B Baker Street"
    assert fields["address_line_2"] == "Indiranagar"
    assert fields["city"] == "Bengaluru"
    assert fields["state"] == "Karnataka"
    assert fields["pincode"] == "560038"

    # Lowercase PAN/IFSC are normalized and must not count as edits.
    profile = await accept_review(
        db_session,
        user=user,
        submitted={**fields, "pan": fields["pan"].lower(), "ifsc_code": fields["ifsc_code"].lower()},
        settings=zto_settings,
    )
    assert not any(
        getattr(profile, f"{prefix}_edited")
        for prefix in ("name", "pan", "dob", "bank_account", "ifsc", "address")
    )
    assert profile.pan_approved == profile.pan_from_lookup == SANDBOX_PAN
    assert await resolve_zto_phase(db_session, user.id, settings=zto_settings) == ZtoPhase.ACCEPTED


@pytest.mark.asyncio
async def test_accept_with_edits_sets_edit_flags_and_prefill_uses_approved(db_session, zto_settings) -> None:
    user = await _user(db_session)
    await _signup_flow(db_session, user, zto_settings)
    fields = (await build_review_data(db_session, user=user, settings=zto_settings))["fields"]

    profile = await accept_review(
        db_session,
        user=user,
        submitted={
            **fields,
            "pan": "PQRSX9876L",
            "date_of_birth": "20/01/1991",
            "ifsc_code": "icic0000042",
        },
        settings=zto_settings,
    )

    assert profile.pan_edited and profile.pan_from_lookup == SANDBOX_PAN and profile.pan_approved == "PQRSX9876L"
    assert profile.dob_edited and profile.dob_from_lookup == SANDBOX_DOB and profile.dob_approved == "1991-01-20"
    assert profile.ifsc_edited and profile.ifsc_approved == "ICIC0000042"
    assert not profile.name_edited
    assert not profile.bank_account_edited
    assert not profile.address_edited

    prefill = await get_approved_prefill(db_session, user.id)
    assert prefill is not None
    assert prefill["pan"] == "PQRSX9876L"
    assert prefill["bank_account_number"] == SANDBOX_BANK_ACCOUNT_NUMBER

    after = await build_review_data(db_session, user=user, settings=zto_settings)
    assert after["phase"] == "ACCEPTED"
    assert after["approved"]["pan"] == "PQRSX9876L"
    assert after["fields"] is None


@pytest.mark.asyncio
async def test_accept_rejects_invalid_format_and_keeps_review_pending(db_session, zto_settings) -> None:
    user = await _user(db_session)
    await _signup_flow(db_session, user, zto_settings)
    fields = (await build_review_data(db_session, user=user, settings=zto_settings))["fields"]

    with pytest.raises(KycError) as exc:
        await accept_review(db_session, user=user, submitted={**fields, "pan": "BADPAN"}, settings=zto_settings)
    assert exc.value.status_code == 422
    assert exc.value.code == "zto_invalid_pan"
    assert await resolve_zto_phase(db_session, user.id, settings=zto_settings) == ZtoPhase.REVIEW_PENDING

    with pytest.raises(KycError) as exc:
        await accept_review(db_session, user=user, submitted={**fields, "ifsc_code": "XX"}, settings=zto_settings)
    assert exc.value.code == "zto_invalid_ifsc_code"


@pytest.mark.asyncio
async def test_decline_writes_no_approved_profile(db_session, zto_settings) -> None:
    user = await _user(db_session)
    await _signup_flow(db_session, user, zto_settings)

    await decline_review(db_session, user=user, settings=zto_settings)

    assert await resolve_zto_phase(db_session, user.id, settings=zto_settings) == ZtoPhase.DECLINED
    approved = (
        await db_session.execute(select(ZtoApprovedProfile).where(ZtoApprovedProfile.user_id == user.id))
    ).scalar_one_or_none()
    assert approved is None
    with pytest.raises(KycError) as exc:
        await decline_review(db_session, user=user, settings=zto_settings)
    assert exc.value.code == "zto_review_not_pending"


@pytest.mark.asyncio
async def test_sandbox_failure_phone_ends_in_lookups_failed(db_session, zto_settings) -> None:
    user = await _user(db_session, phone="9876500000")
    flow = await _signup_flow(db_session, user, zto_settings)
    assert flow is not None
    assert flow.phase == ZtoPhase.LOOKUPS_FAILED.value
    status = await get_flow_status(db_session, user_id=user.id, settings=zto_settings)
    assert status["review_required"] is False


@pytest.mark.asyncio
async def test_registry_blocks_second_user_with_same_phone(db_session, zto_settings) -> None:
    # Phone previously used by another (since purged) account — registry persists the Cybrilla limit.
    first = await _user(db_session)
    db_session.add_all(
        [
            ZtoPhoneRegistry(lookup_kind="bank", phone="9123456780", user_id=first.id),
            ZtoPhoneRegistry(
                lookup_kind="customer", phone="9123456780", normalized_name="asha verma", user_id=first.id
            ),
        ]
    )
    await db_session.flush()

    second = await _user(db_session, phone="9123456780")
    flow = await _signup_flow(db_session, second, zto_settings)

    assert flow is not None
    assert flow.phase == ZtoPhase.LOOKUPS_FAILED.value
    fetches = (
        await db_session.execute(select(ZtoLookupFetch).where(ZtoLookupFetch.user_id == second.id))
    ).scalars().all()
    assert {fetch.status for fetch in fetches} == {FETCH_DUPLICATE}


@pytest.mark.asyncio
async def test_poll_until_terminal_with_in_progress_client(db_session, zto_settings) -> None:
    class SlowClient(SandboxZtoLookupClient):
        def __init__(self) -> None:
            self.get_calls = 0

        async def create_bank_lookup(self, **kwargs):
            response = await super().create_bank_lookup(**kwargs)
            return {**response, "status": "in_progress"}

        async def get_bank_lookup(self, lookup_id: str):
            self.get_calls += 1
            return await super().get_bank_lookup(lookup_id)

    client = SlowClient()
    user = await _user(db_session)
    flow = await _signup_flow(db_session, user, zto_settings, client=client)

    assert client.get_calls == 1
    assert flow is not None and flow.phase == ZtoPhase.REVIEW_PENDING.value
