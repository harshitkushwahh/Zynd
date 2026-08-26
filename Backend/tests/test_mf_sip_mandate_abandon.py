from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_sip_plan_service import abandon_unfinished_mandate_auth
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_abandon_unfinished_mandate_auth_waits_while_mandate_auth_pending(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-abandon-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.auth_pending,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=901,
        fp_mandate_status="CREATED",
    )
    db_session.add(mandate)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=uuid4(),
        fund_id=1,
        amount_inr=Decimal("1000"),
        frequency="monthly",
        installment_day=5,
        status=MfSipPlanStatus.pending,
        mf_mandate_id=mandate.id,
    )
    db_session.add(plan)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 901, "mandate_status": "CREATED"}),
    ):
        changed = await abandon_unfinished_mandate_auth(db_session, plan)

    assert changed is False
    assert plan.status == MfSipPlanStatus.pending
    assert mandate.status == MfMandateStatus.auth_pending


@pytest.mark.asyncio
async def test_abandon_unfinished_mandate_auth_cancels_failed_mandate_and_sip(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-abandon-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.auth_pending,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=901,
        fp_mandate_status="CREATED",
    )
    db_session.add(mandate)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=uuid4(),
        fund_id=1,
        amount_inr=Decimal("1000"),
        frequency="monthly",
        installment_day=5,
        status=MfSipPlanStatus.pending,
        mf_mandate_id=mandate.id,
    )
    db_session.add(plan)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 901, "mandate_status": "FAILED"}),
    ), patch(
        "app.application.mf.mf_mandate_service.cancel_mandate",
        new=AsyncMock(return_value={"id": 901, "mandate_status": "CANCELLED"}),
    ):
        changed = await abandon_unfinished_mandate_auth(db_session, plan)

    assert changed is True
    assert plan.status == MfSipPlanStatus.cancelled
    assert plan.failure_code == "mandate_abandoned"
    assert mandate.status == MfMandateStatus.cancelled


@pytest.mark.asyncio
async def test_abandon_unfinished_mandate_auth_skips_when_mandate_approved(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-abandon-approved-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.auth_pending,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=902,
    )
    db_session.add(mandate)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=uuid4(),
        fund_id=1,
        amount_inr=Decimal("1000"),
        frequency="monthly",
        installment_day=5,
        status=MfSipPlanStatus.pending,
        mf_mandate_id=mandate.id,
    )
    db_session.add(plan)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 902, "mandate_status": "APPROVED"}),
    ), patch(
        "app.application.mf.mf_sip_plan_service.submit_pending_sip_plan",
        new=AsyncMock(return_value=False),
    ):
        changed = await abandon_unfinished_mandate_auth(db_session, plan)

    assert changed is False
    assert plan.status == MfSipPlanStatus.pending
    assert mandate.status == MfMandateStatus.approved
