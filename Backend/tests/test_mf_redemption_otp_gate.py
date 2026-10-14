from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_redemption_service import (
    confirm_redemption_order,
    create_redemption_order,
)
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


async def _seed_redemption(db_session):
    user = User(
        id=uuid4(),
        email=f"redeem-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    amc = FundAmc(name="Kotak", slug=f"kotak-{uuid4().hex[:8]}")
    db_session.add(amc)
    await db_session.flush()
    product = Product(code=f"P{uuid4().hex[:8]}", name="Redeem Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF109K01RT3",
        scheme_name="Kotak Redeem",
        fp_scheme_id=f"scheme-{uuid4().hex[:6]}",
        product_id=product.id,
    )
    db_session.add(fund)
    await db_session.flush()
    mfia = MfInvestmentAccount(
        user_id=user.id,
        fp_mfia_id="fp-mfia-1",
        status=MfInvestmentAccountStatus.active,
    )
    db_session.add(mfia)
    await db_session.flush()
    return user, mfia, product, fund


@pytest.mark.asyncio
async def test_create_redemption_does_not_call_finprim(db_session) -> None:
    user, mfia, _product, _fund = await _seed_redemption(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_redemption_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    None,
                )
            ),
        ),
        patch(
            "app.application.mf.mf_redemption_service._load_redemption_constraints",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.application.mf.mf_redemption_service.invalidate_user_portfolio_cache",
            new=AsyncMock(),
        ),
        patch(
            "app.application.mf.mf_redemption_service.create_mf_redemption",
            new=AsyncMock(),
        ) as create_fp,
    ):
        order = await create_redemption_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            idempotency_key=str(uuid4()),
            redeem_mode="amount",
            amount_inr=Decimal("1000"),
        )
    create_fp.assert_not_called()
    assert order.order_type == MfOrderType.redemption
    assert order.status == MfOrderStatus.pending
    assert order.metadata_.get("fp_redemption_id") is None
    assert order.metadata_.get("transaction_initiated_at")


@pytest.mark.asyncio
async def test_confirm_redemption_creates_finprim_after_otp(db_session) -> None:
    user, mfia, _product, _fund = await _seed_redemption(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_redemption_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    None,
                )
            ),
        ),
        patch(
            "app.application.mf.mf_redemption_service._load_redemption_constraints",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.application.mf.mf_redemption_service.invalidate_user_portfolio_cache",
            new=AsyncMock(),
        ),
    ):
        order = await create_redemption_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            idempotency_key=str(uuid4()),
            redeem_mode="amount",
            amount_inr=Decimal("1000"),
        )

    order.metadata_ = {
        **order.metadata_,
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
    }
    await db_session.flush()

    with (
        patch(
            "app.application.mf.mf_transaction_consent_service.verify_mf_transaction_consent_otp",
            new=AsyncMock(return_value=uuid4()),
        ),
        patch(
            "app.application.mf.mf_redemption_service.create_mf_redemption",
            new=AsyncMock(return_value={"fp_redemption_id": "fp-red-stub", "state": "pending"}),
        ) as create_fp,
        patch(
            "app.application.mf.mf_redemption_service.update_mf_redemption",
            new=AsyncMock(return_value={"state": "confirmed"}),
        ) as update_fp,
    ):
        confirmed = await confirm_redemption_order(
            db_session,
            user_id=user.id,
            order_id=order.id,
            otp="123456",
        )
    create_fp.assert_awaited_once()
    update_fp.assert_awaited_once()
    assert confirmed.metadata_["fp_redemption_id"] == "fp-red-stub"
    assert confirmed.metadata_["redemption_confirmed"] is True
    assert confirmed.metadata_.get("platform_consent_record_id")


@pytest.mark.asyncio
async def test_confirm_redemption_invalid_otp_leaves_no_fp_id(db_session) -> None:
    user, mfia, _product, _fund = await _seed_redemption(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_redemption_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    None,
                )
            ),
        ),
        patch(
            "app.application.mf.mf_redemption_service._load_redemption_constraints",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.application.mf.mf_redemption_service.invalidate_user_portfolio_cache",
            new=AsyncMock(),
        ),
    ):
        order = await create_redemption_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            idempotency_key=str(uuid4()),
            redeem_mode="amount",
            amount_inr=Decimal("1000"),
        )

    order.metadata_ = {
        **order.metadata_,
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
    }
    await db_session.flush()

    with (
        patch(
            "app.application.mf.mf_transaction_consent_service.verify_mf_transaction_consent_otp",
            new=AsyncMock(side_effect=MfOrderError(code="invalid_otp", message="Invalid OTP", status_code=400)),
        ),
        patch(
            "app.application.mf.mf_redemption_service.create_mf_redemption",
            new=AsyncMock(),
        ) as create_fp,
        pytest.raises(MfOrderError) as exc,
    ):
        await confirm_redemption_order(
            db_session,
            user_id=user.id,
            order_id=order.id,
            otp="000000",
        )
    assert exc.value.code == "invalid_otp"
    create_fp.assert_not_called()
    await db_session.refresh(order)
    assert order.metadata_.get("fp_redemption_id") is None


@pytest.mark.asyncio
async def test_confirm_legacy_redemption_skips_second_create(db_session) -> None:
    user, mfia, _product, _fund = await _seed_redemption(db_session)
    holding_id = "61576584::INF109K01RT3"
    with (
        patch(
            "app.application.mf.mf_redemption_service._load_holding_row",
            new=AsyncMock(
                return_value=(
                    mfia,
                    "61576584",
                    "INF109K01RT3",
                    {"redeemable_units": 100, "redeemable_amount_inr": 10000, "nav": 100, "current_value_inr": 10000},
                    "fp-mfia-1",
                    None,
                )
            ),
        ),
        patch(
            "app.application.mf.mf_redemption_service._load_redemption_constraints",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.application.mf.mf_redemption_service.invalidate_user_portfolio_cache",
            new=AsyncMock(),
        ),
    ):
        order = await create_redemption_order(
            db_session,
            user_id=user.id,
            holding_id=holding_id,
            idempotency_key=str(uuid4()),
            redeem_mode="amount",
            amount_inr=Decimal("1000"),
        )

    order.metadata_ = {
        **order.metadata_,
        "consent_otp_sent": True,
        "consent_email": "investor@example.com",
        "consent_mobile": "9876543210",
        "fp_redemption_id": "legacy-fp-red",
    }
    order.fp_state = "pending"
    await db_session.flush()

    with (
        patch(
            "app.application.mf.mf_transaction_consent_service.verify_mf_transaction_consent_otp",
            new=AsyncMock(return_value=uuid4()),
        ),
        patch(
            "app.application.mf.mf_redemption_service.create_mf_redemption",
            new=AsyncMock(),
        ) as create_fp,
        patch(
            "app.application.mf.mf_redemption_service.update_mf_redemption",
            new=AsyncMock(return_value={"state": "confirmed"}),
        ),
    ):
        confirmed = await confirm_redemption_order(
            db_session,
            user_id=user.id,
            order_id=order.id,
            otp="123456",
        )
    create_fp.assert_not_called()
    assert confirmed.metadata_["fp_redemption_id"] == "legacy-fp-red"
    assert confirmed.metadata_["redemption_confirmed"] is True
