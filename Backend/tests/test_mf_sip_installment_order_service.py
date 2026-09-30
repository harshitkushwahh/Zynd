from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_sip_installment_order_service import sync_sip_first_installment_order
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfOrder,
    MfOrderStatus,
    MfOrderType,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_sync_sip_first_installment_order_creates_sip_transaction(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"sip-order-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    amc = FundAmc(name="Test AMC", slug=f"test-amc-{uuid4().hex[:8]}")
    db_session.add(amc)
    await db_session.flush()
    product = Product(code=f"P{uuid4().hex[:8]}", name="DSP Value Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth="INF740KA1PM0",
        scheme_name="DSP VALUE FUND - REGULAR PLAN - GROWTH",
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
        number_of_installments=12,
        status=MfSipPlanStatus.active,
        fp_plan_id="mfpp_test",
        idempotency_key=str(uuid4()),
        metadata_={"fp_scheme_id": "scheme-1"},
    )
    db_session.add(plan)
    await db_session.flush()

    installment = {
        "fp_purchase_id": "mfp_test_purchase",
        "fp_purchase_old_id": 3184,
        "state": "submitted",
        "raw": {"amount": 100},
    }

    with patch(
        "app.application.mf.mf_sip_installment_order_service._fetch_first_installment_payment_status",
        new=AsyncMock(return_value=("SUCCESS", {"amc_order_ids": [3184]})),
    ), patch(
        "app.application.mf.mf_sip_installment_order_service.get_mf_purchase",
        new=AsyncMock(return_value={"state": "submitted", "amount": 100}),
    ):
        order = await sync_sip_first_installment_order(db_session, plan, installment=installment)

    assert order is not None
    assert order.order_type == MfOrderType.sip
    assert order.fp_purchase_id == "mfp_test_purchase"
    assert order.fp_purchase_old_id == 3184
    assert order.status == MfOrderStatus.processing
    assert order.metadata_["sip_installment"] == "first"
    assert order.metadata_["sip_plan_id"] == str(plan.id)

    persisted = await db_session.get(MfOrder, order.id)
    assert persisted is not None
