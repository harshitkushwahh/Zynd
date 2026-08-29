from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.recommendations.allocation_mapper import compute_allocation_slices
from app.application.recommendations.basket_admin_service import (
    create_basket,
    publish_config,
    replace_basket_funds,
)
from app.application.recommendations.funds_for_you_service import resolve_for_user
from app.application.recommendations.selection_utils import stable_index
from app.infrastructure.persistence.mf_models import (
    FundAmc,
    MutualFund,
    Product,
    ProductLifecycleStatus,
    ProductType,
)
from app.infrastructure.persistence.models import KycOverallStatus, User, UserKycStatus
from app.infrastructure.persistence.recommendation_models import RecommendationConfig, UserRecommendationSnapshot
from app.infrastructure.persistence.risk_profile_models import (
    RiskProfileAssessment,
    RiskTier,
    UserRiskProfile,
)


async def _create_investable_fund(db_session: AsyncSession, *, label: str) -> tuple[Product, MutualFund, FundAmc]:
    amc = FundAmc(
        name=f"AMC {label}",
        slug=f"amc-{label}-{uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(amc)
    await db_session.flush()

    product = Product(
        code=f"P{uuid4().hex[:8]}",
        name=f"Fund {label}",
        product_type=ProductType.mutual_fund,
        lifecycle_status=ProductLifecycleStatus.active,
    )
    db_session.add(product)
    await db_session.flush()

    fund = MutualFund(
        amc_id=amc.id,
        isin_growth=f"INF{uuid4().hex[:10].upper()}",
        scheme_name=f"Scheme {label}",
        product_id=product.id,
        is_active=True,
        fp_oms_purchase_allowed=True,
        fp_oms_active=True,
        min_lumpsum_amount=1000,
    )
    db_session.add(fund)
    await db_session.flush()
    return product, fund, amc


async def _seed_eligible_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid4(),
        email=f"ffy-{uuid4()}@example.com",
        phone=f"+9198{uuid4().int % 10_000_000_000:010d}"[-12:],
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.completed))

    assessment = RiskProfileAssessment(user_id=user.id, score=550, tier=RiskTier.moderate)
    db_session.add(assessment)
    await db_session.flush()

    db_session.add(
        UserRiskProfile(
            user_id=user.id,
            score=550,
            tier=RiskTier.moderate,
            assessment_id=assessment.id,
        )
    )
    await db_session.flush()
    return user


async def _seed_basket_with_funds(db_session: AsyncSession, *, fund_count: int = 6) -> tuple[User, list[str]]:
    admin = User(
        id=uuid4(),
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
    )
    db_session.add(admin)
    await db_session.flush()

    if not await db_session.get(RecommendationConfig, 1):
        db_session.add(RecommendationConfig(id=1, published_version=1))
        await db_session.flush()

    basket = await create_basket(
        db_session,
        admin_user_id=admin.id,
        tier=RiskTier.moderate,
        name="Balanced Core",
        slug="balanced-core",
    )
    products = []
    for index in range(fund_count):
        product, _, _ = await _create_investable_fund(db_session, label=str(index))
        products.append(product)

    await replace_basket_funds(
        db_session,
        UUID(basket["id"]),
        admin_user_id=admin.id,
        funds=[{"product_id": str(product.id), "sort_order": index} for index, product in enumerate(products)],
    )
    return admin, [str(product.id) for product in products]


def test_stable_index_is_deterministic() -> None:
    assert stable_index("user:moderate:1", 3) == stable_index("user:moderate:1", 3)
    assert 0 <= stable_index("another-seed", 5) < 5


def test_compute_allocation_slices_from_categories() -> None:
    slices = compute_allocation_slices(
        [
            {"primary_category_slug": "large-cap-equity"},
            {"primary_category_slug": "large-cap-equity"},
            {"primary_category_slug": "short-duration-debt"},
            {"primary_category_slug": "balanced-hybrid"},
            {"primary_category_slug": "gold-funds"},
        ]
    )
    assert sum(slice_["value_pct"] for slice_ in slices) == pytest.approx(100.0, abs=0.2)
    bucket_ids = {slice_["id"] for slice_ in slices}
    assert "equity" in bucket_ids
    assert "debt" in bucket_ids


@pytest.mark.asyncio
async def test_blocked_without_kyc(db_session: AsyncSession) -> None:
    user = await _seed_eligible_user(db_session)
    kyc = await db_session.get(UserKycStatus, user.id)
    assert kyc is not None
    kyc.overall_status = KycOverallStatus.in_progress
    await db_session.flush()

    result = await resolve_for_user(db_session, user.id)
    assert result["eligible"] is False
    assert result["block_reason"] == "kyc_required"


@pytest.mark.asyncio
async def test_blocked_without_risk_profile(db_session: AsyncSession) -> None:
    user = User(
        id=uuid4(),
        email=f"no-risk-{uuid4()}@example.com",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.completed))
    await db_session.flush()

    result = await resolve_for_user(db_session, user.id)
    assert result["eligible"] is False
    assert result["block_reason"] == "risk_profile_required"


@pytest.mark.asyncio
async def test_blocked_without_baskets(db_session: AsyncSession) -> None:
    user = await _seed_eligible_user(db_session)
    if not await db_session.get(RecommendationConfig, 1):
        db_session.add(RecommendationConfig(id=1, published_version=1))
        await db_session.flush()

    result = await resolve_for_user(db_session, user.id)
    assert result["eligible"] is False
    assert result["block_reason"] == "no_baskets"


@pytest.mark.asyncio
async def test_resolve_returns_five_funds(db_session: AsyncSession) -> None:
    user = await _seed_eligible_user(db_session)
    await _seed_basket_with_funds(db_session, fund_count=8)

    first = await resolve_for_user(db_session, user.id)
    second = await resolve_for_user(db_session, user.id)

    assert first["eligible"] is True
    assert len(first["funds"]) == 5
    assert first["funds"] == second["funds"]
    assert first["basket_name"] == "Balanced Core"
    assert sum(slice_["value_pct"] for slice_ in first["allocation"]) == pytest.approx(100.0, abs=0.2)

    snapshot = await db_session.get(UserRecommendationSnapshot, user.id)
    assert snapshot is not None
    assert len(snapshot.fund_product_ids) == 5


@pytest.mark.asyncio
async def test_publish_invalidates_snapshot_on_next_resolve(db_session: AsyncSession) -> None:
    user = await _seed_eligible_user(db_session)
    admin, _ = await _seed_basket_with_funds(db_session, fund_count=6)

    first = await resolve_for_user(db_session, user.id)
    await publish_config(db_session, admin_user_id=admin.id)
    second = await resolve_for_user(db_session, user.id)

    assert first["config_version"] == 1
    assert second["config_version"] == 2
    snapshot = await db_session.get(UserRecommendationSnapshot, user.id)
    assert snapshot is not None
    assert snapshot.config_version == 2
