from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_systematic_plan_service import (
    cancel_systematic_plan,
    confirm_systematic_plan,
    create_stp_plan,
    create_swp_plan,
)
from app.infrastructure.mf.fp_oms_client import create_mf_redemption_plan, create_mf_switch_plan
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


@pytest.fixture(autouse=True)
def _disable_finprim(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.infrastructure.mf.fp_oms_client.is_finprim_enabled", lambda: False)


async def test_create_redemption_plan_stub_is_monthly_systematic() -> None:
    result = await create_mf_redemption_plan(
        body={
            "mf_investment_account": "mfia",
            "folio_number": "61576584",
            "scheme": "INF109K01RT3",
            "frequency": "monthly",
            "installment_day": 5,
            "amount": 1000,
            "number_of_installments": 12,
            "systematic": True,
            "auto_generate_installments": True,
            "source_ref_id": "plan-1",
        }
    )
    assert result["fp_plan_id"] == "stub-mfrp-id"
    raw = result["raw"]
    assert raw["folio_number"] == "61576584"
    assert raw["frequency"] == "monthly"
    assert raw["systematic"] is True
    assert "generate_first_installment_now" not in raw


async def test_create_switch_plan_stub_requires_folio() -> None:
    result = await create_mf_switch_plan(
        body={
            "mf_investment_account": "mfia",
            "folio_number": "61576584",
            "switch_out_scheme": "INF109K01RT3",
            "switch_in_scheme": "INF109K01TP7",
            "frequency": "monthly",
            "systematic": True,
            "source_ref_id": "plan-2",
        }
    )
    assert result["fp_plan_id"] == "stub-mfsp-id"
    assert result["raw"]["folio_number"] == "61576584"


async def _seed_plans(db_session):
    user = User(
        id=uuid4(),
        email=f"sys-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    amc = FundAmc(name="Kotak", slug=f"kotak-{uuid4().hex[:8]}")
    other = FundAmc(name="Other", slug=f"other-{uuid4().hex[:8]}")
    db_session.add_all([amc, other])
    await db_session.flush()
    out_product = Product(code=f"P{uuid4().hex[:8]}", name="Out", product_type=ProductType.mutual_fund)
    in_product = Product(code=f"P{uuid4().hex[:8]}", name="In", product_type=ProductType.mutual_fund)
    other_product = Product(code=f"P{uuid4().hex[:8]}", name="Other", product_type=ProductType.mutual_fund)
    db_session.add_all([out_product, in_product, other_product])
    await db_session.flush()
    out_fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF109K01RT3",
        scheme_name="Out",
        fp_scheme_id=f"out-{uuid4().hex[:6]}",
        product_id=out_product.id,
    )
    in_fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF109K01TP7",
        scheme_name="In",
        fp_scheme_id=f"in-{uuid4().hex[:6]}",
        product_id=in_product.id,
    )
    other_fund = MutualFund(
        amc_id=other.id,
        isin_growth="INF173K01FE6",
        scheme_name="Other",
        fp_scheme_id=f"oth-{uuid4().hex[:6]}",
        product_id=other_product.id,
    )
    db_session.add_all([out_fund, in_fund, other_fund])
    await db_session.flush()
    mfia = MfInvestmentAccount(
        user_id=user.id,
        fp_mfia_id="fp-mfia-1",
        status=MfInvestmentAccountStatus.active,
    )
    db_session.add(mfia)
    await db_session.flush()
    return user, mfia, in_product, other_product


def _holding_patch(mfia):
    return patch(
        "app.application.mf.mf_systematic_plan_service._load_holding_row",
        new=AsyncMock(
            return_value=(
                mfia,
                "61576584",
                "INF109K01RT3",
                {"redeemable_amount_inr": 50000, "current_value_inr": 50000},
                "fp-mfia-1",
                {},
            )
        ),
    )


@pytest.mark.asyncio
async def test_create_swp_confirm_cancel_monthly(db_session) -> None:
    user, mfia, _in_product, _other = await _seed_plans(db_session)
    with _holding_patch(mfia):
        plan = await create_swp_plan(
            db_session,
            user_id=user.id,
            holding_id="61576584::INF109K01RT3",
            idempotency_key=str(uuid4()),
            amount_inr=Decimal("1000"),
            installment_day=5,
            number_of_installments=12,
        )
    assert plan.frequency == "monthly"
    assert plan.folio_number == "61576584"
    assert plan.fp_plan_id == "stub-mfrp-id"

    plan.metadata_ = {
        **(plan.metadata_ or {}),
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
    }
    await db_session.flush()
    with patch(
        "app.application.mf.mf_systematic_plan_service.verify_otp",
        new=AsyncMock(return_value=True),
    ):
        confirmed = await confirm_systematic_plan(db_session, plan, otp="123456")
    assert confirmed.metadata_["plan_confirmed"] is True
    cancelled = await cancel_systematic_plan(db_session, confirmed)
    assert cancelled.status == MfSipPlanStatus.cancelled


@pytest.mark.asyncio
async def test_create_swp_requires_folio(db_session) -> None:
    user, mfia, _in_product, _other = await _seed_plans(db_session)
    with (
        patch(
            "app.application.mf.mf_systematic_plan_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "",
                    "INF109K01RT3",
                    {"redeemable_amount_inr": 50000, "current_value_inr": 50000},
                    "fp-mfia-1",
                    {},
                )
            ),
        ),
        pytest.raises(MfOrderError) as exc,
    ):
        await create_swp_plan(
            db_session,
            user_id=user.id,
            holding_id="::INF109K01RT3",
            idempotency_key=str(uuid4()),
            amount_inr=Decimal("1000"),
            installment_day=5,
            number_of_installments=12,
        )
    assert exc.value.code == "folio_required"


@pytest.mark.asyncio
async def test_create_stp_rejects_different_amc(db_session) -> None:
    user, mfia, _in_product, other_product = await _seed_plans(db_session)
    with _holding_patch(mfia), pytest.raises(MfOrderError) as exc:
        await create_stp_plan(
            db_session,
            user_id=user.id,
            holding_id="61576584::INF109K01RT3",
            switch_in_product_id=other_product.id,
            idempotency_key=str(uuid4()),
            amount_inr=Decimal("1000"),
            installment_day=5,
            number_of_installments=12,
        )
    assert exc.value.code == "switch_amc_mismatch"


@pytest.mark.asyncio
async def test_create_stp_confirm_cancel(db_session) -> None:
    user, mfia, in_product, _other = await _seed_plans(db_session)
    with _holding_patch(mfia):
        plan = await create_stp_plan(
            db_session,
            user_id=user.id,
            holding_id="61576584::INF109K01RT3",
            switch_in_product_id=in_product.id,
            idempotency_key=str(uuid4()),
            amount_inr=Decimal("1000"),
            installment_day=8,
            number_of_installments=12,
        )
    assert plan.frequency == "monthly"
    assert plan.folio_number == "61576584"
    assert plan.fp_plan_id == "stub-mfsp-id"
    plan.metadata_ = {
        **(plan.metadata_ or {}),
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
    }
    await db_session.flush()
    with patch(
        "app.application.mf.mf_systematic_plan_service.verify_otp",
        new=AsyncMock(return_value=True),
    ):
        confirmed = await confirm_systematic_plan(db_session, plan, otp="123456")
    assert confirmed.metadata_["plan_confirmed"] is True
    cancelled = await cancel_systematic_plan(db_session, confirmed)
    assert cancelled.status == MfSipPlanStatus.cancelled
