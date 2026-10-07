from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_mandate_service import (
    MANDATE_AUTH_EXPIRED_CODE,
    expire_unapproved_mandate_auth,
    initiate_mandate_auth,
    mandate_auth_window_elapsed,
)
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)


def _mandate(**overrides) -> MfMandate:
    now = datetime.now(timezone.utc)
    mandate = MfMandate(
        user_id=uuid4(),
        bank_account_old_id=101,
        status=MfMandateStatus.auth_pending,
        mandate_limit=15_000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=901,
        auth_token_url="https://cybrilla.example/token",
        created_at=now - timedelta(minutes=3),
    )
    for key, value in overrides.items():
        setattr(mandate, key, value)
    return mandate


def test_mandate_auth_window_is_two_minutes() -> None:
    now = datetime.now(timezone.utc)
    fresh = _mandate(created_at=now - timedelta(seconds=90))
    stale = _mandate(created_at=now - timedelta(minutes=2, seconds=1))
    approved = _mandate(status=MfMandateStatus.approved, created_at=now - timedelta(minutes=10))

    assert mandate_auth_window_elapsed(fresh, now=now) is False
    assert mandate_auth_window_elapsed(stale, now=now) is True
    assert mandate_auth_window_elapsed(approved, now=now) is False


def test_unissued_mandate_is_not_expired() -> None:
    mandate = _mandate(
        status=MfMandateStatus.pending,
        auth_token_url=None,
        fp_mandate_id=None,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    assert mandate_auth_window_elapsed(mandate) is False


def _session_with(plan: MfSipPlan):
    result = MagicMock()
    result.scalars.return_value = [plan]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    session.flush = AsyncMock()
    session.add = MagicMock()
    return session


def _open_plan(mandate: MfMandate, **overrides) -> MfSipPlan:
    plan = MfSipPlan(
        id=uuid4(),
        user_id=mandate.user_id,
        product_id=uuid4(),
        fund_id=1,
        amount_inr=Decimal("1000"),
        frequency="monthly",
        installment_day=5,
        number_of_installments=12,
        status=MfSipPlanStatus.pending,
        mf_mandate_id=mandate.id,
        idempotency_key=str(uuid4()),
    )
    for key, value in overrides.items():
        setattr(plan, key, value)
    return plan


@pytest.mark.asyncio
async def test_expire_unapproved_mandate_auth_fails_sip_when_unpaid() -> None:
    mandate = _mandate()
    plan = _open_plan(mandate)
    session = _session_with(plan)

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 901, "mandate_status": "CREATED"}),
    ):
        expired = await expire_unapproved_mandate_auth(session, mandate)

    assert expired is True
    assert mandate.status == MfMandateStatus.failed
    assert mandate.failure_code == MANDATE_AUTH_EXPIRED_CODE
    assert mandate.auth_token_url is None
    assert plan.status == MfSipPlanStatus.failed
    assert plan.failure_code == MANDATE_AUTH_EXPIRED_CODE


@pytest.mark.asyncio
async def test_expire_unapproved_mandate_auth_keeps_paid_sip() -> None:
    mandate = _mandate(fp_mandate_id=902)
    plan = _open_plan(
        mandate,
        status=MfSipPlanStatus.consent_pending,
        metadata_={"sip": {"first_installment": {"status": "paid"}}},
    )
    session = _session_with(plan)

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 902, "mandate_status": "CREATED"}),
    ):
        expired = await expire_unapproved_mandate_auth(session, mandate)

    assert expired is False
    assert plan.status == MfSipPlanStatus.consent_pending
    assert mandate.status != MfMandateStatus.failed


@pytest.mark.asyncio
async def test_authorize_again_mints_a_new_link_when_cybrilla_repeats_the_old_one() -> None:
    mandate = _mandate(id=uuid4(), fp_mandate_id=901, auth_token_url="https://cybrilla.example/token")
    plan = _open_plan(mandate)
    plan.mf_mandate_id = mandate.id
    session = _session_with(plan)

    async def fake_authorize(*, mandate_id: int, payment_postback_url: str | None = None):
        if int(mandate_id) == 901:
            return {"token_url": "https://cybrilla.example/token"}
        return {"token_url": f"https://cybrilla.example/fresh/{mandate_id}"}

    with (
        patch(
            "app.application.mf.mf_mandate_service.authorize_mandate",
            new=AsyncMock(side_effect=fake_authorize),
        ),
        patch(
            "app.application.mf.mf_mandate_service.create_mandate",
            new=AsyncMock(return_value={"id": 2002}),
        ),
        patch(
            "app.application.mf.mf_mandate_service.cancel_mandate",
            new=AsyncMock(return_value={"id": 901}),
        ),
    ):
        fresh = await initiate_mandate_auth(session, mandate)

    assert fresh is not mandate
    assert fresh.fp_mandate_id == 2002
    assert fresh.auth_token_url == "https://cybrilla.example/fresh/2002"
    assert mandate.status == MfMandateStatus.cancelled
    assert plan.mf_mandate_id == fresh.id
