from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_sip_first_installment_service import classify_first_installment_state
from app.application.mf.mf_sip_plan_service import (
    _refresh_sip_plan_from_fp,
    cancel_sip_plan,
    sip_plan_is_operational,
)
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


def test_classify_first_installment_state_pending() -> None:
    assert classify_first_installment_state("submitted") == "pending"
    assert classify_first_installment_state("pending") == "pending"


def test_classify_first_installment_state_paid() -> None:
    assert classify_first_installment_state("confirmed") == "paid"
    assert classify_first_installment_state("successful") == "paid"


def test_sip_plan_is_operational_excludes_cancelled_and_failed_markers() -> None:
    from datetime import datetime, timezone

    def _plan(**overrides):
        base = dict(
            user_id=uuid4(),
            product_id=uuid4(),
            fund_id=1,
            amount_inr=Decimal("100"),
            frequency="monthly",
            number_of_installments=12,
            status=MfSipPlanStatus.active,
            idempotency_key=str(uuid4()),
        )
        base.update(overrides)
        return MfSipPlan(**base)

    assert sip_plan_is_operational(_plan()) is True
    assert sip_plan_is_operational(_plan(cancelled_at=datetime.now(timezone.utc))) is False
    assert sip_plan_is_operational(_plan(fp_state="cancelled")) is False
    assert sip_plan_is_operational(_plan(metadata_={"sip": {"user_cancelled": True}})) is False


@pytest.mark.asyncio
async def test_resolve_sip_first_installment_pending_on_ondc_without_purchase(db_session, monkeypatch) -> None:
    from app.application.mf.mf_sip_first_installment_service import resolve_sip_first_installment

    monkeypatch.setattr(
        "app.application.mf.mf_sip_first_installment_service._ondc_gateway_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_sip_first_installment_service.list_mf_purchases_for_plan",
        AsyncMock(return_value=[]),
    )

    plan = MfSipPlan(
        user_id=uuid4(),
        product_id=uuid4(),
        fund_id=1,
        amount_inr=Decimal("100"),
        frequency="monthly",
        number_of_installments=12,
        status=MfSipPlanStatus.active,
        fp_plan_id="mfpp_test",
        idempotency_key=str(uuid4()),
    )
    db_session.add(plan)
    await db_session.flush()

    payload = await resolve_sip_first_installment(db_session, plan)
    assert payload["status"] == "pending"
    assert payload["amount_inr"] == 100.0
    assert payload["payment_url"] is None


@pytest.mark.asyncio
async def test_refresh_sip_plan_from_fp_does_not_repair_cancelled_to_active(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-cancel-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    amc = FundAmc(name="Test AMC", slug=f"test-amc-{uuid4().hex[:8]}")
    db_session.add(amc)
    await db_session.flush()
    product = Product(code=f"P{uuid4().hex[:8]}", name="Debt Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF740K01714",
        scheme_name="DSP SAVINGS FUND - GROWTH",
        fp_scheme_id="1774",
        product_id=product.id,
    )
    db_session.add(fund)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=product.id,
        fund_id=fund.id,
        amount_inr=Decimal("100"),
        frequency="monthly",
        installment_day=20,
        number_of_installments=12,
        status=MfSipPlanStatus.cancelled,
        fp_plan_id="mfpp_test",
        fp_state="cancelled",
        idempotency_key=str(uuid4()),
    )
    db_session.add(plan)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_sip_plan_service.get_mf_purchase_plan",
        new=AsyncMock(
            return_value={
                "data": {
                    "id": "mfpp_test",
                    "state": "active",
                    "next_installment_date": "2026-10-20",
                }
            }
        ),
    ):
        changed = await _refresh_sip_plan_from_fp(db_session, plan, repair_terminal=True)

    assert changed is True
    assert plan.status == MfSipPlanStatus.cancelled
    assert plan.fp_state == "active"


@pytest.mark.asyncio
async def test_cancel_sip_plan_marks_user_cancelled(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-cancel-meta-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=901,
        fp_mandate_status="APPROVED",
    )
    db_session.add(mandate)
    await db_session.flush()

    amc = FundAmc(name="Test AMC", slug=f"test-amc-{uuid4().hex[:8]}")
    db_session.add(amc)
    await db_session.flush()
    product = Product(code=f"P{uuid4().hex[:8]}", name="Debt Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF740K01714",
        scheme_name="DSP SAVINGS FUND - GROWTH",
        fp_scheme_id="1774",
        product_id=product.id,
    )
    db_session.add(fund)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=product.id,
        fund_id=fund.id,
        amount_inr=Decimal("100"),
        frequency="monthly",
        installment_day=20,
        number_of_installments=12,
        status=MfSipPlanStatus.active,
        mf_mandate_id=mandate.id,
        fp_plan_id="mfpp_test",
        fp_state="active",
        idempotency_key=str(uuid4()),
    )
    db_session.add(plan)
    await db_session.flush()

    with (
        patch(
            "app.application.mf.mf_sip_plan_service.cancel_mf_purchase_plan",
            new=AsyncMock(return_value={"state": "cancelled"}),
        ),
        patch(
            "app.application.mf.mf_sip_plan_service.get_mf_purchase_plan",
            new=AsyncMock(return_value={"data": {"id": "mfpp_test", "state": "cancelled"}}),
        ),
        patch(
            "app.application.mf.mf_sip_plan_service.maybe_release_mandate_after_sip_change",
            new=AsyncMock(),
        ),
    ):
        updated = await cancel_sip_plan(db_session, plan)

    assert updated.status == MfSipPlanStatus.cancelled
    assert updated.metadata_["sip"]["user_cancelled"] is True
