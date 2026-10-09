from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_switch_service import (
    _is_closed_maturity_scheme,
    confirm_switch_order,
    create_switch_order,
    list_switch_destinations,
)
from app.infrastructure.mf.fp_oms_client import create_mf_switch
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
    MfOrderStatus,
    MfOrderType,
)
from app.infrastructure.persistence.models import User


@pytest.fixture(autouse=True)
def _disable_finprim(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.infrastructure.mf.fp_oms_client.is_finprim_enabled", lambda: False)


async def test_create_mf_switch_stub_includes_folio() -> None:
    result = await create_mf_switch(
        fp_mfia_id="mfia",
        folio_number="61576584",
        switch_out_scheme="INF109K01RT3",
        switch_in_scheme="INF109K01TP7",
        source_ref_id="order-1",
        amount_inr=1000,
    )
    assert result["fp_switch_id"] == "stub-mfs-id"
    assert result["raw"]["folio_number"] == "61576584"
    assert result["raw"]["switch_out_scheme"] == "INF109K01RT3"
    assert result["raw"]["switch_in_scheme"] == "INF109K01TP7"


async def _seed_switch_funds(db_session):
    user = User(
        id=uuid4(),
        email=f"switch-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    amc_a = FundAmc(name="Kotak", slug=f"kotak-{uuid4().hex[:8]}")
    amc_b = FundAmc(name="Other", slug=f"other-{uuid4().hex[:8]}")
    db_session.add_all([amc_a, amc_b])
    await db_session.flush()
    out_product = Product(code=f"P{uuid4().hex[:8]}", name="Out Fund", product_type=ProductType.mutual_fund)
    in_product = Product(code=f"P{uuid4().hex[:8]}", name="In Fund", product_type=ProductType.mutual_fund)
    other_product = Product(code=f"P{uuid4().hex[:8]}", name="Other AMC", product_type=ProductType.mutual_fund)
    db_session.add_all([out_product, in_product, other_product])
    await db_session.flush()
    out_fund = MutualFund(
        amc_id=amc_a.id,
        isin_growth="INF109K01RT3",
        scheme_name="Kotak Out",
        fp_scheme_id=f"out-{uuid4().hex[:6]}",
        product_id=out_product.id,
    )
    in_fund = MutualFund(
        amc_id=amc_a.id,
        isin_growth="INF109K01TP7",
        scheme_name="Kotak In",
        fp_scheme_id=f"in-{uuid4().hex[:6]}",
        product_id=in_product.id,
    )
    other_fund = MutualFund(
        amc_id=amc_b.id,
        isin_growth="INF173K01FE6",
        scheme_name="Other AMC",
        fp_scheme_id=f"oth-{uuid4().hex[:6]}",
        product_id=other_product.id,
    )
    fmp_product = Product(
        code=f"P{uuid4().hex[:8]}",
        name="HDFC FMP 92D March 2016 (2) - Regular",
        product_type=ProductType.mutual_fund,
    )
    db_session.add(fmp_product)
    await db_session.flush()
    fmp_fund = MutualFund(
        amc_id=amc_a.id,
        isin_growth="INF179K01AA1",
        scheme_name="HDFC FMP 92D March 2016 (2)",
        fp_scheme_id=f"fmp-{uuid4().hex[:6]}",
        product_id=fmp_product.id,
        sebi_category="Close Ended - Fixed Maturity",
    )
    db_session.add_all([out_fund, in_fund, other_fund, fmp_fund])
    await db_session.flush()
    mfia = MfInvestmentAccount(
        user_id=user.id,
        fp_mfia_id="fp-mfia-1",
        status=MfInvestmentAccountStatus.active,
    )
    db_session.add(mfia)
    await db_session.flush()
    return user, mfia, out_product, in_product, other_product, out_fund, in_fund


@pytest.mark.asyncio
async def test_create_switch_rejects_different_amc(db_session) -> None:
    user, mfia, _out_product, _in_product, other_product, _out_fund, _in_fund = await _seed_switch_funds(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_switch_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    {},
                )
            ),
        ),
        pytest.raises(MfOrderError) as exc,
    ):
        await create_switch_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            switch_in_product_id=other_product.id,
            idempotency_key=str(uuid4()),
            switch_mode="amount",
            amount_inr=Decimal("1000"),
        )
    assert exc.value.code == "switch_amc_mismatch"


@pytest.mark.asyncio
async def test_create_and_confirm_switch_with_stub_fp(db_session) -> None:
    user, mfia, _out_product, in_product, _other, _out_fund, _in_fund = await _seed_switch_funds(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_switch_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    {},
                )
            ),
        ),
        patch(
            "app.application.mf.mf_switch_service.get_fund_scheme_by_isin",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "app.application.mf.mf_switch_service.invalidate_user_portfolio_cache",
            new=AsyncMock(),
        ),
    ):
        order = await create_switch_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            switch_in_product_id=in_product.id,
            idempotency_key=str(uuid4()),
            switch_mode="amount",
            amount_inr=Decimal("1000"),
        )
    assert order.order_type == MfOrderType.switch
    assert order.status == MfOrderStatus.pending
    assert order.metadata_.get("fp_switch_id") is None
    assert order.metadata_["folio_number"] == "61576584"

    order.metadata_ = {
        **order.metadata_,
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
    }
    await db_session.flush()
    with (
        patch("app.application.mf.mf_switch_service.verify_otp", new=AsyncMock(return_value=True)),
        patch("app.application.mf.mf_switch_service.invalidate_user_portfolio_cache", new=AsyncMock()),
        patch(
            "app.application.mf.mf_switch_service.create_mf_switch",
            new=AsyncMock(return_value={"fp_switch_id": "stub-mfs-id", "state": "pending"}),
        ) as create_fp,
    ):
        confirmed = await confirm_switch_order(
            db_session,
            user_id=user.id,
            order_id=order.id,
            otp="123456",
        )
    create_fp.assert_awaited_once()
    assert confirmed.metadata_["fp_switch_id"] == "stub-mfs-id"
    assert confirmed.metadata_["switch_confirmed"] is True
    assert confirmed.status in {MfOrderStatus.processing, MfOrderStatus.payment_pending}


@pytest.mark.asyncio
async def test_list_switch_destinations_includes_amc_logo_fields(db_session) -> None:
    user, mfia, _out_product, in_product, other_product, _out_fund, in_fund = await _seed_switch_funds(db_session)
    holding_id = "61576584::INF109K01RT3"
    with patch(
        "app.application.mf.mf_switch_service._load_holding_row",
        new=AsyncMock(
            return_value=(
                mfia,
                "61576584",
                "INF109K01RT3",
                {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                "fp-mfia-1",
                {},
            )
        ),
    ):
        destinations = await list_switch_destinations(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
        )
    dest_ids = {item["product_id"] for item in destinations}
    assert str(in_product.id) in dest_ids
    assert str(other_product.id) not in dest_ids
    assert all("FMP" not in item["name"] for item in destinations)
    matching = next(item for item in destinations if item["product_id"] == str(in_product.id))
    assert matching["amc_name"] == "Kotak"
    assert matching["amc_slug"]
    assert matching["fund_id"] == in_fund.id


def test_closed_maturity_scheme_detects_fmp_series_name() -> None:
    fund = SimpleNamespace(
        scheme_name="HDFC FMP 92D March 2016 (2) - Regular Growth-Series 36",
        sebi_category=None,
    )
    product = SimpleNamespace(name="HDFC FMP 92D March 2016 (2) - Regular Growth-Series 36")
    assert _is_closed_maturity_scheme(fund, product) is True
