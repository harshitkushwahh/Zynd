from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.zto.client import ZtoLookupClient, get_zto_lookup_client
from app.application.kyc.zto.constants import (
    CONSENT_MODE_CHECKBOX,
    FETCH_DUPLICATE,
    FETCH_FAILED,
    FETCH_PENDING,
    FETCH_SUCCESS,
    FETCH_TIMEOUT,
    LOOKUP_KIND_BANK,
    LOOKUP_KIND_CUSTOMER,
    is_provider_lookup_failure,
    is_provider_lookup_success,
    provider_lookup_status,
    PURPOSE_BY_KIND,
    consent_text,
)
from app.application.kyc.zto.crypto import decrypt_lookup_payload, encrypt_lookup_payload
from app.application.kyc.zto.errors import ZtoError
from app.application.kyc.zto.normalize import (
    build_cybrilla_lookup_consent,
    build_lookup_snapshot,
    normalize_lookup_phone,
    normalize_name,
)
from app.application.kyc.zto.phase import ZtoPhase, get_flow, is_review_required, resolve_phase_from_flow
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.zto_models import (
    ZtoConsentRecord,
    ZtoLookupFetch,
    ZtoPhoneRegistry,
    ZtoUserFlow,
)

logger = logging.getLogger(__name__)

_NO_RESTART_PHASES = frozenset(
    {ZtoPhase.LOOKUPS_RUNNING, ZtoPhase.REVIEW_PENDING, ZtoPhase.ACCEPTED, ZtoPhase.DECLINED}
)


def normalized_name_key(name: str | None) -> str:
    return (normalize_name(name) or "").lower()


def display_name_from_parts(first_name: str, middle_name: str | None, last_name: str) -> str:
    return " ".join(part.strip() for part in (first_name, middle_name or "", last_name) if part and part.strip())


async def _consents_by_purpose(db: AsyncSession, user_id: uuid.UUID) -> dict[str, ZtoConsentRecord]:
    rows = (
        await db.execute(
            select(ZtoConsentRecord)
            .where(ZtoConsentRecord.user_id == user_id)
            .order_by(ZtoConsentRecord.collected_at.desc())
        )
    ).scalars()
    result: dict[str, ZtoConsentRecord] = {}
    for row in rows:
        result.setdefault(row.purpose, row)
    return result


async def record_consents(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    ip: str | None,
    signup_correlation_id: str | None = None,
    settings: Settings | None = None,
) -> list[ZtoConsentRecord]:
    """Persist one consent row per lookup type (idempotent per purpose)."""
    settings = settings or get_settings()
    existing = await _consents_by_purpose(db, user_id)
    now = utcnow()
    records: list[ZtoConsentRecord] = []
    for kind in (LOOKUP_KIND_BANK, LOOKUP_KIND_CUSTOMER):
        purpose = PURPOSE_BY_KIND[kind]
        if purpose in existing:
            records.append(existing[purpose])
            continue
        record = ZtoConsentRecord(
            user_id=user_id,
            purpose=purpose,
            text=consent_text(kind, settings.zto_partner_name),
            mode=CONSENT_MODE_CHECKBOX,
            ip_address=ip,
            collected_at=now,
            signup_correlation_id=signup_correlation_id,
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


async def upsert_flow(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    signup_display_name: str | None = None,
    phase: ZtoPhase | None = None,
) -> ZtoUserFlow:
    flow = await get_flow(db, user_id)
    if flow is None:
        flow = ZtoUserFlow(
            user_id=user_id,
            phase=(phase or ZtoPhase.LOOKUP_PENDING).value,
            signup_display_name=signup_display_name,
        )
        db.add(flow)
    else:
        if signup_display_name:
            flow.signup_display_name = signup_display_name
        if phase is not None:
            flow.phase = phase.value
    await db.flush()
    return flow


async def _find_registry(
    db: AsyncSession, *, kind: str, phone: str, normalized_name: str | None
) -> ZtoPhoneRegistry | None:
    stmt = select(ZtoPhoneRegistry).where(ZtoPhoneRegistry.lookup_kind == kind, ZtoPhoneRegistry.phone == phone)
    if kind == LOOKUP_KIND_CUSTOMER:
        stmt = stmt.where(ZtoPhoneRegistry.normalized_name == normalized_name)
    return (await db.execute(stmt)).scalars().first()


async def _register(
    db: AsyncSession, *, kind: str, phone: str, normalized_name: str | None, user_id: uuid.UUID, fetch_id: uuid.UUID
) -> None:
    try:
        async with db.begin_nested():
            db.add(
                ZtoPhoneRegistry(
                    lookup_kind=kind,
                    phone=phone,
                    normalized_name=normalized_name if kind == LOOKUP_KIND_CUSTOMER else None,
                    user_id=user_id,
                    fetch_id=fetch_id,
                )
            )
    except IntegrityError:
        logger.warning("ZTO registry race for kind=%s", kind)


async def _poll_lookup(
    client: ZtoLookupClient,
    *,
    kind: str,
    create_response: dict[str, Any],
    settings: Settings,
) -> tuple[str, dict[str, Any]]:
    """Return (fetch_status, last_response). Polls until terminal or attempts exhausted."""
    lookup_id = str(create_response.get("id") or "")
    if not lookup_id:
        return FETCH_FAILED, create_response

    getter = client.get_bank_lookup if kind == LOOKUP_KIND_BANK else client.get_customer_lookup
    max_attempts = max(settings.zto_max_poll_attempts, 1)
    interval_s = max(settings.zto_poll_interval_ms, 0) / 1000

    initial = provider_lookup_status(create_response)
    if is_provider_lookup_success(initial):
        return FETCH_SUCCESS, create_response
    if is_provider_lookup_failure(initial):
        return FETCH_FAILED, create_response

    response = create_response
    last_status = initial
    for attempt in range(1, max_attempts + 1):
        response = await getter(lookup_id)
        last_status = provider_lookup_status(response)
        if is_provider_lookup_success(last_status):
            return FETCH_SUCCESS, response
        if is_provider_lookup_failure(last_status):
            return FETCH_FAILED, response
        if attempt < max_attempts and interval_s > 0:
            await asyncio.sleep(interval_s)

    if is_provider_lookup_success(last_status):
        return FETCH_SUCCESS, response
    logger.warning(
        "ZTO %s lookup poll exhausted id=%s last_status=%r attempts=%s",
        kind,
        lookup_id,
        last_status,
        max_attempts,
    )
    return FETCH_TIMEOUT, response


async def _run_lookup(
    db: AsyncSession,
    *,
    client: ZtoLookupClient,
    user: User,
    kind: str,
    name: str | None,
    consent: ZtoConsentRecord,
    settings: Settings,
) -> ZtoLookupFetch:
    phone = normalize_lookup_phone(user.phone)
    if len(phone) < 10:
        fetch = ZtoLookupFetch(
            user_id=user.id,
            kind=kind,
            status=FETCH_FAILED,
            phone=phone or (user.phone or ""),
            lookup_name=name if kind == LOOKUP_KIND_CUSTOMER else None,
            error_message="Valid phone number is required.",
        )
        db.add(fetch)
        await db.flush()
        return fetch
    name_key = normalized_name_key(name) if kind == LOOKUP_KIND_CUSTOMER else None

    registry = await _find_registry(db, kind=kind, phone=phone, normalized_name=name_key)
    if registry is not None:
        if registry.user_id == user.id and registry.fetch_id:
            prior = await db.get(ZtoLookupFetch, registry.fetch_id)
            if prior is not None and prior.status == FETCH_SUCCESS:
                return prior
        fetch = ZtoLookupFetch(
            user_id=user.id,
            kind=kind,
            status=FETCH_DUPLICATE,
            phone=phone,
            lookup_name=name if kind == LOOKUP_KIND_CUSTOMER else None,
            error_message="Lookup already used for this phone number.",
        )
        db.add(fetch)
        await db.flush()
        return fetch

    fetch = ZtoLookupFetch(
        user_id=user.id,
        kind=kind,
        status=FETCH_PENDING,
        phone=phone,
        source_ref_id=str(uuid.uuid4()),
        lookup_name=name if kind == LOOKUP_KIND_CUSTOMER else None,
    )
    db.add(fetch)
    await db.flush()

    consent_block = build_cybrilla_lookup_consent(
        text=consent.text,
        mode=consent.mode,
        collected_at=consent.collected_at,
        ip_address=consent.ip_address,
    )

    try:
        if kind == LOOKUP_KIND_BANK:
            created = await client.create_bank_lookup(
                source_ref_id=fetch.source_ref_id, phone_number=phone, consent=consent_block
            )
        else:
            created = await client.create_customer_lookup(
                source_ref_id=fetch.source_ref_id,
                phone_number=phone,
                name=name or "",
                consent=consent_block,
            )
        fetch.fp_lookup_id = str(created.get("id") or "") or None
        status, last = await _poll_lookup(client, kind=kind, create_response=created, settings=settings)
        if status == FETCH_TIMEOUT and is_provider_lookup_success(provider_lookup_status(last)):
            status = FETCH_SUCCESS
    except NotImplementedError as exc:
        fetch.status = FETCH_FAILED
        fetch.error_message = str(exc)[:255]
        await db.flush()
        return fetch
    except Exception as exc:  # noqa: BLE001 — provider failures must not break signup
        logger.exception("ZTO %s lookup failed for user %s", kind, user.id)
        fetch.status = FETCH_FAILED
        fetch.error_message = f"{type(exc).__name__}"[:255]
        await db.flush()
        return fetch

    fetch.status = status
    if status == FETCH_SUCCESS:
        fetch.payload_encrypted, fetch.key_version = encrypt_lookup_payload(kind, last)
        await db.flush()
        # Register only successful lookups so failed attempts can be retried within Cybrilla limits.
        await _register(
            db, kind=kind, phone=phone, normalized_name=name_key, user_id=user.id, fetch_id=fetch.id
        )
    else:
        fetch.error_message = str(last.get("error") or status)[:255]
        await db.flush()
    return fetch


async def start_lookups(
    db: AsyncSession,
    *,
    user: User,
    name_override: str | None = None,
    settings: Settings | None = None,
    client: ZtoLookupClient | None = None,
) -> ZtoUserFlow:
    """Run bank lookup then customer lookup (verified phone + stored consents required)."""
    settings = settings or get_settings()
    if not settings.zto_enabled:
        raise ZtoError("Zero-touch lookup is not enabled.", "zto_disabled", 404)
    if not user.phone or user.phone_verified_at is None:
        raise ZtoError("Verify your mobile number before lookups.", "zto_phone_not_verified", 400)

    consents = await _consents_by_purpose(db, user.id)
    if any(PURPOSE_BY_KIND[kind] not in consents for kind in (LOOKUP_KIND_BANK, LOOKUP_KIND_CUSTOMER)):
        raise ZtoError("Both lookup consents are required.", "zto_consent_required", 400)

    flow = await get_flow(db, user.id)
    if flow is None:
        flow = await upsert_flow(db, user_id=user.id)
    if resolve_phase_from_flow(flow, enabled=True) in _NO_RESTART_PHASES:
        return flow

    name = normalize_name(name_override) or normalize_name(flow.signup_display_name)
    if not name:
        raise ZtoError("Name is required to start the lookup.", "zto_name_required", 400)
    flow.signup_display_name = name

    try:
        client = client or get_zto_lookup_client(settings)
    except NotImplementedError as exc:
        flow.phase = ZtoPhase.LOOKUPS_FAILED.value
        await db.flush()
        logger.warning("ZTO client unavailable: %s", exc)
        return flow

    flow.phase = ZtoPhase.LOOKUPS_RUNNING.value
    await db.flush()
    logger.info(
        "ZTO lookups starting user=%s mode=%s client=%s",
        user.id,
        settings.zto_mode,
        type(client).__name__,
    )

    bank_fetch = await _run_lookup(
        db,
        client=client,
        user=user,
        kind=LOOKUP_KIND_BANK,
        name=None,
        consent=consents[PURPOSE_BY_KIND[LOOKUP_KIND_BANK]],
        settings=settings,
    )
    customer_fetch = await _run_lookup(
        db,
        client=client,
        user=user,
        kind=LOOKUP_KIND_CUSTOMER,
        name=name,
        consent=consents[PURPOSE_BY_KIND[LOOKUP_KIND_CUSTOMER]],
        settings=settings,
    )

    snapshot = build_lookup_snapshot(
        _decrypt_fetch(bank_fetch),
        _decrypt_fetch(customer_fetch),
    )
    has_usable_data = any(
        snapshot.get(key)
        for key in (
            "name",
            "pan",
            "date_of_birth",
            "bank_account_number",
            "ifsc_code",
            "address_line_1",
            "address_line_2",
            "city",
            "state",
            "pincode",
        )
    )
    flow.phase = (ZtoPhase.REVIEW_PENDING if has_usable_data else ZtoPhase.LOOKUPS_FAILED).value
    await db.flush()
    logger.info(
        "ZTO lookups finished user=%s phase=%s bank=%s customer=%s",
        user.id,
        flow.phase,
        bank_fetch.status,
        customer_fetch.status,
    )
    return flow


def _decrypt_fetch(fetch: ZtoLookupFetch | None) -> dict[str, Any] | None:
    if fetch is None or fetch.status != FETCH_SUCCESS or not fetch.payload_encrypted or fetch.key_version is None:
        return None
    return decrypt_lookup_payload(fetch.kind, fetch.payload_encrypted, fetch.key_version)


async def latest_fetches(db: AsyncSession, user_id: uuid.UUID) -> dict[str, ZtoLookupFetch]:
    """Most relevant fetch per kind (successful one preferred, else latest)."""
    rows = (
        await db.execute(
            select(ZtoLookupFetch)
            .where(ZtoLookupFetch.user_id == user_id)
            .order_by(ZtoLookupFetch.created_at.desc())
        )
    ).scalars().all()
    result: dict[str, ZtoLookupFetch] = {}
    for row in rows:
        current = result.get(row.kind)
        if current is None or (current.status != FETCH_SUCCESS and row.status == FETCH_SUCCESS):
            result[row.kind] = row
    return result


async def load_decrypted_payloads(
    db: AsyncSession, user_id: uuid.UUID
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, ZtoLookupFetch]]:
    fetches = await latest_fetches(db, user_id)
    return (
        _decrypt_fetch(fetches.get(LOOKUP_KIND_BANK)),
        _decrypt_fetch(fetches.get(LOOKUP_KIND_CUSTOMER)),
        fetches,
    )


async def opt_in_and_start_lookups(
    db: AsyncSession,
    *,
    user: User,
    bank_consent: bool,
    customer_consent: bool,
    ip: str | None,
    settings: Settings | None = None,
    client: ZtoLookupClient | None = None,
) -> ZtoUserFlow:
    """Logged-in users who skipped ZTO at signup can record consents and start lookups."""
    settings = settings or get_settings()
    if bank_consent != customer_consent or not bank_consent:
        raise ZtoError("Both lookup consents are required.", "zto_consent_pair_required", 400)

    flow = await get_flow(db, user.id)
    phase = resolve_phase_from_flow(flow, enabled=settings.zto_enabled)
    if phase not in {ZtoPhase.NOT_STARTED, ZtoPhase.LOOKUP_PENDING}:
        raise ZtoError("Zero-touch lookup already started for this account.", "zto_already_started", 409)

    await record_consents(db, user_id=user.id, ip=ip, signup_correlation_id=str(user.id), settings=settings)
    display_name = display_name_from_parts(user.first_name or "", user.middle_name, user.last_name or "")
    if not normalize_name(display_name):
        raise ZtoError("Add your name in profile before starting lookup.", "zto_name_required", 400)
    await upsert_flow(db, user_id=user.id, signup_display_name=display_name)
    try:
        return await start_lookups(db, user=user, settings=settings, client=client)
    except Exception:  # noqa: BLE001
        logger.exception("ZTO opt-in start failed for user %s", user.id)
        return await upsert_flow(db, user_id=user.id, phase=ZtoPhase.LOOKUPS_FAILED)


async def handle_signup_zto(
    db: AsyncSession,
    *,
    user: User,
    first_name: str,
    middle_name: str | None,
    last_name: str,
    bank_consent: bool,
    customer_consent: bool,
    ip: str | None,
    settings: Settings | None = None,
    client: ZtoLookupClient | None = None,
) -> ZtoUserFlow | None:
    """Signup hook: record both consents, store name, run lookups. Never raises into signup."""
    settings = settings or get_settings()
    if not (settings.zto_enabled and bank_consent and customer_consent):
        return None
    await record_consents(db, user_id=user.id, ip=ip, signup_correlation_id=str(user.id), settings=settings)
    flow = await upsert_flow(
        db,
        user_id=user.id,
        signup_display_name=display_name_from_parts(first_name, middle_name, last_name),
    )
    try:
        async with db.begin_nested():
            await start_lookups(db, user=user, settings=settings, client=client)
    except Exception:  # noqa: BLE001 — lookups are best-effort; user continues with manual KYC
        logger.exception("ZTO start failed during signup for user %s", user.id)
        flow = await upsert_flow(db, user_id=user.id, phase=ZtoPhase.LOOKUPS_FAILED)
    return flow


async def get_flow_status(
    db: AsyncSession, *, user_id: uuid.UUID, settings: Settings | None = None
) -> dict[str, Any]:
    settings = settings or get_settings()
    if not settings.zto_enabled:
        return {
            "enabled": False,
            "phase": ZtoPhase.DISABLED.value,
            "review_required": False,
            "bank_status": None,
            "customer_status": None,
        }
    flow = await get_flow(db, user_id)
    phase = resolve_phase_from_flow(flow, enabled=True)
    fetches = await latest_fetches(db, user_id)
    bank = fetches.get(LOOKUP_KIND_BANK)
    customer = fetches.get(LOOKUP_KIND_CUSTOMER)
    return {
        "enabled": True,
        "phase": phase.value,
        "review_required": is_review_required(phase),
        "bank_status": bank.status if bank else None,
        "customer_status": customer.status if customer else None,
    }
