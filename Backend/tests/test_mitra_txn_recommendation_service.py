from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.distributor_client_link_service import create_distributor_client_link
from app.application.distributor.mitra_txn_recommendation_service import (
    CreateMitraTxnRecommendationInput,
    CreateMitraTxnRecommendationItemInput,
    MitraTxnRecommendationError,
    apply_mitra_txn_recommendation_for_investor,
    create_mitra_txn_recommendation,
    get_mitra_txn_recommendation_for_investor,
    list_mitra_txn_recommendations_for_actor,
)
from app.application.documents.client_id_service import assign_client_id
from app.infrastructure.persistence.mf_models import (
    FundAmc,
    MutualFund,
    Product,
    ProductLifecycleStatus,
    ProductType,
)
from app.infrastructure.persistence.mitra_txn_recommendation_models import MitraTxnInvestmentType, MitraTxnPaymentMethod
from app.infrastructure.persistence.models import KycOverallStatus, User, UserKycStatus, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password

from tests.test_distributor_client_book import _mitra_auth_headers


async def _create_investable_fund(db_session: AsyncSession) -> Product:
    amc = FundAmc(
        name=f"AMC {uuid4().hex[:6]}",
        slug=f"amc-{uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(amc)
    await db_session.flush()

    product = Product(
        code=f"P{uuid4().hex[:8]}",
        name=f"Fund {uuid4().hex[:6]}",
        product_type=ProductType.mutual_fund,
        lifecycle_status=ProductLifecycleStatus.active,
    )
    db_session.add(product)
    await db_session.flush()

    fund = MutualFund(
        amc_id=amc.id,
        isin_growth=f"INF{uuid4().hex[:10].upper()}",
        scheme_name=product.name,
        product_id=product.id,
        is_active=True,
        fp_oms_purchase_allowed=True,
        fp_oms_active=True,
        min_lumpsum_amount=1000,
    )
    db_session.add(fund)
    await db_session.flush()
    return product


async def _create_kyc_ready_investor(db_session: AsyncSession) -> User:
    investor = User(
        email=f"investor-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        first_name="Test",
        last_name="Investor",
    )
    db_session.add(investor)
    await db_session.flush()
    await assign_client_id(db_session, investor)
    db_session.add(UserKycStatus(user_id=investor.id, overall_status=KycOverallStatus.completed))
    await db_session.flush()
    return investor


@pytest.mark.asyncio
async def test_create_and_apply_mitra_txn_recommendation(db_session: AsyncSession) -> None:
    _, mitra = await _mitra_auth_headers(db_session)
    investor = await _create_kyc_ready_investor(db_session)
    product = await _create_investable_fund(db_session)
    await create_distributor_client_link(db_session, client_user=investor, actor=mitra)
    await db_session.commit()

    created = await create_mitra_txn_recommendation(
        db_session,
        actor=mitra,
        payload=CreateMitraTxnRecommendationInput(
            client_reference=investor.client_id,
            investment_type=MitraTxnInvestmentType.one_time,
            payment_method=MitraTxnPaymentMethod.upi,
            items=[
                CreateMitraTxnRecommendationItemInput(
                    product_id=product.id,
                    amount_inr=Decimal("5000"),
                )
            ],
        ),
    )

    assert created["status"] == "sent"
    assert created["item_count"] == 1
    assert len(created["items"]) == 1
    assert created["client_code"] == investor.client_id
    assert created["link"]
    token = created["token"]

    loaded = await get_mitra_txn_recommendation_for_investor(
        db_session,
        investor=investor,
        token=token,
    )
    assert loaded["fund_name"] == product.name
    assert loaded["cart_path"] == "/dashboard/mutual-funds/cart"

    applied = await apply_mitra_txn_recommendation_for_investor(
        db_session,
        investor=investor,
        token=token,
    )
    assert applied["applied"] is True
    assert applied["status"] == "opened"
    assert applied["redirect_path"] == "/dashboard/mutual-funds/cart"


@pytest.mark.asyncio
async def test_list_mitra_txn_recommendations_for_actor_returns_sent_links(
    db_session: AsyncSession,
) -> None:
    _, mitra = await _mitra_auth_headers(db_session)
    investor = await _create_kyc_ready_investor(db_session)
    product = await _create_investable_fund(db_session)
    await create_distributor_client_link(db_session, client_user=investor, actor=mitra)
    await db_session.commit()

    created = await create_mitra_txn_recommendation(
        db_session,
        actor=mitra,
        payload=CreateMitraTxnRecommendationInput(
            client_reference=investor.client_id,
            investment_type=MitraTxnInvestmentType.one_time,
            payment_method=MitraTxnPaymentMethod.upi,
            items=[
                CreateMitraTxnRecommendationItemInput(
                    product_id=product.id,
                    amount_inr=Decimal("5000"),
                )
            ],
        ),
    )
    await db_session.commit()

    listed = await list_mitra_txn_recommendations_for_actor(db_session, actor=mitra)
    assert len(listed) == 1
    assert listed[0]["token"] == created["token"]


@pytest.mark.asyncio
async def test_create_mitra_txn_recommendation_rejects_non_book_client(db_session: AsyncSession) -> None:
    _, mitra = await _mitra_auth_headers(db_session)
    investor = await _create_kyc_ready_investor(db_session)
    product = await _create_investable_fund(db_session)
    await db_session.commit()

    with pytest.raises(MitraTxnRecommendationError) as exc:
        await create_mitra_txn_recommendation(
            db_session,
            actor=mitra,
            payload=CreateMitraTxnRecommendationInput(
                client_reference=investor.client_id,
                investment_type=MitraTxnInvestmentType.one_time,
                payment_method=MitraTxnPaymentMethod.upi,
                items=[
                    CreateMitraTxnRecommendationItemInput(
                        product_id=product.id,
                        amount_inr=Decimal("5000"),
                    )
                ],
            ),
        )

    assert exc.value.code == "client_not_in_book"


@pytest.mark.asyncio
async def test_apply_mitra_txn_recommendation_rejects_other_investor(db_session: AsyncSession) -> None:
    _, mitra = await _mitra_auth_headers(db_session)
    investor = await _create_kyc_ready_investor(db_session)
    other_investor = await _create_kyc_ready_investor(db_session)
    product = await _create_investable_fund(db_session)
    await create_distributor_client_link(db_session, client_user=investor, actor=mitra)
    await db_session.commit()

    created = await create_mitra_txn_recommendation(
        db_session,
        actor=mitra,
        payload=CreateMitraTxnRecommendationInput(
            client_reference=investor.client_id,
            investment_type=MitraTxnInvestmentType.one_time,
            payment_method=MitraTxnPaymentMethod.upi,
            items=[
                CreateMitraTxnRecommendationItemInput(
                    product_id=product.id,
                    amount_inr=Decimal("5000"),
                )
            ],
        ),
    )

    with pytest.raises(MitraTxnRecommendationError) as exc:
        await apply_mitra_txn_recommendation_for_investor(
            db_session,
            investor=other_investor,
            token=created["token"],
        )

    assert exc.value.code == "forbidden"
