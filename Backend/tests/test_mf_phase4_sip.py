from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_fp_state import map_fp_mandate_status, map_fp_plan_state
from app.application.mf.mf_sip_plan_service import submit_pending_sip_plan
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


def test_map_fp_plan_state_active() -> None:
    from app.infrastructure.persistence.mf_transaction_models import MfSipPlanStatus

    assert map_fp_plan_state("active") == MfSipPlanStatus.active
    assert map_fp_plan_state("review_completed") == MfSipPlanStatus.consent_pending


def test_map_fp_mandate_status_approved() -> None:
    from app.infrastructure.persistence.mf_transaction_models import MfMandateStatus

    assert map_fp_mandate_status("APPROVED") == MfMandateStatus.approved
    assert map_fp_mandate_status("ACTIVE") == MfMandateStatus.approved
    assert map_fp_mandate_status("CREATED") == MfMandateStatus.auth_pending


@pytest.mark.asyncio
async def test_submit_pending_sip_plan_requests_first_installment_generation(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-submit-{uuid4()}@example.com",
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
    product = Product(code=f"P{uuid4().hex[:8]}", name="Gold Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF209K01PF4",
        scheme_name="ADITYA BIRLA SUN LIFE GOLD FUND - GROWTH",
        fp_scheme_id="2188",
        product_id=product.id,
    )
    db_session.add(fund)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=product.id,
        fund_id=fund.id,
        amount_inr=Decimal("2500"),
        frequency="monthly",
        installment_day=12,
        number_of_installments=24,
        status=MfSipPlanStatus.pending,
        mf_mandate_id=mandate.id,
        idempotency_key=str(uuid4()),
        metadata_={"fp_scheme_id": "2188"},
    )
    db_session.add(plan)
    await db_session.flush()

    captured: dict = {}

    async def _capture_create(*, body: dict) -> dict:
        captured.update(body)
        return {
            "fp_plan_id": "fp-plan-1",
            "state": "created",
            "source_ref_id": body.get("source_ref_id"),
            "next_installment_date": None,
        }

    with (
        patch(
            "app.application.mf.mf_sip_plan_service.get_or_create_mf_investment_account",
            new=AsyncMock(return_value=type("Mfia", (), {"id": uuid4()})()),
        ),
        patch(
            "app.application.mf.mf_sip_plan_service._ensure_fp_mfia",
            new=AsyncMock(return_value="fp-mfia-1"),
        ),
        patch(
            "app.application.mf.mf_sip_plan_service.create_mf_purchase_plan",
            new=AsyncMock(side_effect=_capture_create),
        ),
    ):
        changed = await submit_pending_sip_plan(db_session, plan)

    assert changed is True
    assert captured["scheme"] == "INF209K01PF4"
    assert "gateway" not in captured
    assert captured["installment_day"] == 12
    assert captured["number_of_installments"] == 24
    assert captured["generate_first_installment_now"] is True
    assert captured["auto_generate_installments"] is True
    assert captured["payment_source"] == "901"
