from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import is_product_investable
from app.application.mf.mf_cart_service import list_cart_items
from app.application.mf.mf_scheme_resolution import matching_fund_isins, mutual_fund_isin_in
from app.application.mf.portfolio_holdings_service import list_user_portfolio_holdings
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.application.recommendations.allocation_mapper import compute_allocation_slices
from app.application.recommendations.portfolio_story_builder import build_portfolio_story
from app.application.recommendations.recommendation_metrics import record_resolve
from app.application.recommendations.selection_utils import seeded_rng, stable_index
from app.infrastructure.persistence.mf_transaction_models import MfCartInvestmentType
from app.infrastructure.persistence.mf_models import Category, FundAmc, MutualFund, Product, ProductCategory
from app.infrastructure.persistence.models import KycOverallStatus, UserKycStatus
from app.infrastructure.persistence.recommendation_models import (
    RecommendationBasket,
    RecommendationBasketFund,
    RecommendationConfig,
    UserRecommendationSnapshot,
)
from app.infrastructure.persistence.risk_profile_models import RiskTier, UserRiskProfile

FUNDS_FOR_YOU_COUNT = 5

BlockReason = str

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PoolFundRow:
    product_id: UUID
    fund_id: int
    scheme_name: str
    amc_id: int
    amc_name: str
    amc_slug: str
    amc_logo_url: str | None
    min_lumpsum_amount_inr: float | None
    sort_order: int
    is_anchor: bool
    allocation_weight_pct: Decimal | None
    primary_category_slug: str | None


def _blocked(block_reason: BlockReason, *, config_version: int = 0) -> dict[str, Any]:
    return {
        "eligible": False,
        "block_reason": block_reason,
        "tier": None,
        "basket_name": None,
        "config_version": config_version,
        "funds": [],
        "allocation": [],
    }


async def get_published_version(session: AsyncSession) -> int:
    row = await session.get(RecommendationConfig, 1)
    if not row:
        return 0
    return int(row.published_version)


async def count_investable_basket_funds(session: AsyncSession, basket_id: UUID) -> int:
    pool = await _load_investable_pool(session, basket_id)
    return len(pool)


def _finalize_resolve(
    payload: dict[str, Any],
    *,
    user_id: UUID,
    started: float,
    snapshot_hit: bool = False,
    degraded: bool = False,
    basket_id: str | None = None,
) -> dict[str, Any]:
    duration_ms = (time.perf_counter() - started) * 1000
    record_resolve(
        eligible=bool(payload.get("eligible")),
        block_reason=payload.get("block_reason"),
        snapshot_hit=snapshot_hit,
        degraded=degraded,
        duration_ms=duration_ms,
    )
    logger.info(
        "funds_for_you_resolved user_id=%s tier=%s eligible=%s block_reason=%s basket_id=%s config_version=%s snapshot_hit=%s degraded=%s duration_ms=%.2f",
        user_id,
        payload.get("tier"),
        payload.get("eligible"),
        payload.get("block_reason"),
        basket_id,
        payload.get("config_version"),
        snapshot_hit,
        degraded,
        duration_ms,
    )
    return payload


async def resolve_for_user(session: AsyncSession, user_id: UUID) -> dict[str, Any]:
    started = time.perf_counter()
    config_version = await get_published_version(session)

    kyc = await session.get(UserKycStatus, user_id)
    if not kyc or kyc.overall_status != KycOverallStatus.completed:
        return _finalize_resolve(
            _blocked("kyc_required", config_version=config_version),
            user_id=user_id,
            started=started,
        )

    profile = await session.get(UserRiskProfile, user_id)
    if not profile:
        return _finalize_resolve(
            _blocked("risk_profile_required", config_version=config_version),
            user_id=user_id,
            started=started,
        )

    tier = profile.tier
    snapshot = await session.get(UserRecommendationSnapshot, user_id)
    if (
        snapshot
        and snapshot.tier == tier
        and snapshot.config_version == config_version
    ):
        funds = await _hydrate_selected_funds(session, snapshot.fund_product_ids)
        if len(funds) == FUNDS_FOR_YOU_COUNT and all(fund.get("investable") for fund in funds):
            basket = await session.get(RecommendationBasket, snapshot.basket_id)
            payload = await _success_from_snapshot(session, snapshot, funds)
            return _finalize_resolve(
                await _enrich_success_payload(
                    session,
                    user_id=user_id,
                    basket=basket,
                    payload=payload,
                ),
                user_id=user_id,
                started=started,
                snapshot_hit=True,
                basket_id=str(snapshot.basket_id),
            )

    degraded = bool(snapshot)
    baskets = await _list_active_baskets(session, tier)
    if not baskets:
        return _finalize_resolve(
            _blocked("no_baskets", config_version=config_version),
            user_id=user_id,
            started=started,
            degraded=degraded,
        )

    basket_index = stable_index(f"{user_id}:{tier.value}:{config_version}", len(baskets))
    basket = baskets[basket_index]
    pool = await _load_investable_pool(session, basket.id)
    initial_basket_id = basket.id

    if len(pool) < FUNDS_FOR_YOU_COUNT:
        basket, pool = await _fallback_basket_with_pool(
            session,
            baskets=baskets,
            start_index=basket_index,
            min_count=FUNDS_FOR_YOU_COUNT,
        )
        if basket is None or len(pool) < FUNDS_FOR_YOU_COUNT:
            return _finalize_resolve(
                _blocked("insufficient_funds", config_version=config_version),
                user_id=user_id,
                started=started,
                degraded=True,
            )
        if basket.id != initial_basket_id:
            degraded = True

    selected = _pick_five_stable(
        pool,
        seed=f"{user_id}:{basket.id}:{config_version}",
    )
    allocation = compute_allocation_slices([_pool_fund_to_allocation_input(row) for row in selected])
    fund_product_ids = [str(row.product_id) for row in selected]
    hydrated = [_serialize_fund_row(row) for row in selected]

    await _upsert_snapshot(
        session,
        user_id=user_id,
        tier=tier,
        basket=basket,
        config_version=config_version,
        fund_product_ids=fund_product_ids,
        allocation_slices=allocation,
    )

    return _finalize_resolve(
        await _enrich_success_payload(
            session,
            user_id=user_id,
            basket=basket,
            payload={
                "eligible": True,
                "block_reason": None,
                "tier": tier.value,
                "basket_name": _public_basket_name(basket),
                "config_version": config_version,
                "funds": hydrated,
                "allocation": allocation,
            },
        ),
        user_id=user_id,
        started=started,
        degraded=degraded,
        basket_id=str(basket.id),
    )


async def preview_for_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    tier: RiskTier | None = None,
) -> dict[str, Any]:
    """Admin preview — same selection path without persisting snapshot."""
    config_version = await get_published_version(session)

    if tier is None:
        profile = await session.get(UserRiskProfile, user_id)
        if not profile:
            return _blocked("risk_profile_required", config_version=config_version)
        tier = profile.tier

    baskets = await _list_active_baskets(session, tier)
    if not baskets:
        return _blocked("no_baskets", config_version=config_version)

    basket_index = stable_index(f"{user_id}:{tier.value}:{config_version}", len(baskets))
    basket = baskets[basket_index]
    pool = await _load_investable_pool(session, basket.id)
    if len(pool) < FUNDS_FOR_YOU_COUNT:
        basket, pool = await _fallback_basket_with_pool(
            session,
            baskets=baskets,
            start_index=basket_index,
            min_count=FUNDS_FOR_YOU_COUNT,
        )
        if basket is None or len(pool) < FUNDS_FOR_YOU_COUNT:
            return _blocked("insufficient_funds", config_version=config_version)

    selected = _pick_five_stable(pool, seed=f"{user_id}:{basket.id}:{config_version}")
    allocation = compute_allocation_slices([_pool_fund_to_allocation_input(row) for row in selected])
    return await _enrich_success_payload(
        session,
        user_id=user_id,
        basket=basket,
        payload={
            "eligible": True,
            "block_reason": None,
            "tier": tier.value,
            "basket_name": _public_basket_name(basket),
            "config_version": config_version,
            "funds": [_serialize_fund_row(row) for row in selected],
            "allocation": allocation,
        },
    )


async def _success_from_snapshot(
    session: AsyncSession,
    snapshot: UserRecommendationSnapshot,
    funds: list[dict[str, Any]],
) -> dict[str, Any]:
    basket_name = await load_basket_name(session, snapshot.basket_id)
    return {
        "eligible": True,
        "block_reason": None,
        "tier": snapshot.tier.value,
        "basket_name": basket_name,
        "config_version": snapshot.config_version,
        "funds": [
            {
                "product_id": fund["product_id"],
                "fund_id": fund["fund_id"],
                "scheme_name": fund["scheme_name"],
                "amc_name": fund["amc_name"],
                "amc_logo_url": fund["amc_logo_url"],
                "amc_slug": fund.get("amc_slug"),
                "min_lumpsum_amount_inr": fund["min_lumpsum_amount_inr"],
            }
            for fund in funds
        ],
        "allocation": snapshot.allocation_slices,
    }


async def _hydrate_selected_funds(session: AsyncSession, product_ids: list) -> list[dict[str, Any]]:
    parsed_ids = [UUID(str(product_id)) for product_id in product_ids]
    rows = await _load_pool_rows_for_products(session, parsed_ids)
    by_id = {row.product_id: row for row in rows}
    hydrated: list[dict[str, Any]] = []
    for product_id in parsed_ids:
        row = by_id.get(product_id)
        if not row:
            hydrated.append({"investable": False})
            continue
        serialized = _serialize_fund_row(row)
        serialized["investable"] = True
        hydrated.append(serialized)
    return hydrated


async def _list_active_baskets(session: AsyncSession, tier: RiskTier) -> list[RecommendationBasket]:
    result = await session.execute(
        select(RecommendationBasket)
        .where(
            RecommendationBasket.tier == tier,
            RecommendationBasket.is_active.is_(True),
        )
        .order_by(RecommendationBasket.sort_order, RecommendationBasket.created_at)
    )
    return list(result.scalars().all())


async def _fallback_basket_with_pool(
    session: AsyncSession,
    *,
    baskets: list[RecommendationBasket],
    start_index: int,
    min_count: int,
) -> tuple[RecommendationBasket | None, list[PoolFundRow]]:
    if not baskets:
        return None, []
    for offset in range(len(baskets)):
        index = (start_index + offset) % len(baskets)
        basket = baskets[index]
        pool = await _load_investable_pool(session, basket.id)
        if len(pool) >= min_count:
            return basket, pool
    return None, []


async def _load_investable_pool(session: AsyncSession, basket_id: UUID) -> list[PoolFundRow]:
    result = await session.execute(
        select(RecommendationBasketFund)
        .where(
            RecommendationBasketFund.basket_id == basket_id,
            RecommendationBasketFund.is_active.is_(True),
            RecommendationBasketFund.is_alternative.is_(False),
        )
        .order_by(RecommendationBasketFund.sort_order, RecommendationBasketFund.created_at)
    )
    links = list(result.scalars().all())
    if not links:
        return []

    product_ids = [link.product_id for link in links]
    rows = await _load_pool_rows_for_products(session, product_ids)
    link_by_product = {link.product_id: link for link in links}
    pool: list[PoolFundRow] = []
    for row in rows:
        link = link_by_product.get(row.product_id)
        if not link:
            continue
        pool.append(
            PoolFundRow(
                product_id=row.product_id,
                fund_id=row.fund_id,
                scheme_name=row.scheme_name,
                amc_id=row.amc_id,
                amc_name=row.amc_name,
                amc_slug=row.amc_slug,
                amc_logo_url=row.amc_logo_url,
                min_lumpsum_amount_inr=row.min_lumpsum_amount_inr,
                sort_order=link.sort_order,
                is_anchor=link.is_anchor,
                allocation_weight_pct=link.allocation_weight_pct,
                primary_category_slug=row.primary_category_slug,
            )
        )
    pool.sort(key=lambda item: item.sort_order)
    return pool


async def _load_pool_rows_for_products(
    session: AsyncSession,
    product_ids: list[UUID],
) -> list[PoolFundRow]:
    if not product_ids:
        return []

    result = await session.execute(
        select(Product, MutualFund, FundAmc)
        .join(MutualFund, MutualFund.product_id == Product.id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .where(Product.id.in_(product_ids))
    )

    category_map = await _primary_category_slugs(session, product_ids)
    rows: list[PoolFundRow] = []
    for product, fund, amc in result.all():
        if not is_product_investable(product=product, fund=fund, amc=amc):
            continue
        min_lumpsum = float(fund.min_lumpsum_amount) if fund.min_lumpsum_amount is not None else None
        rows.append(
            PoolFundRow(
                product_id=product.id,
                fund_id=fund.id,
                scheme_name=fund.scheme_name,
                amc_id=amc.id,
                amc_name=amc.name,
                amc_slug=amc.slug,
                amc_logo_url=resolve_amc_logo_url(amc.logo_url, amc.slug),
                min_lumpsum_amount_inr=min_lumpsum,
                sort_order=0,
                is_anchor=False,
                allocation_weight_pct=None,
                primary_category_slug=category_map.get(product.id),
            )
        )
    return rows


async def _primary_category_slugs(session: AsyncSession, product_ids: list[UUID]) -> dict[UUID, str]:
    result = await session.execute(
        select(ProductCategory.product_id, Category.slug)
        .join(Category, Category.id == ProductCategory.category_id)
        .where(ProductCategory.product_id.in_(product_ids))
        .order_by(ProductCategory.display_order.nulls_last(), ProductCategory.id)
    )
    mapping: dict[UUID, str] = {}
    for product_id, slug in result.all():
        if product_id not in mapping:
            mapping[product_id] = slug
    return mapping


def _pick_five_stable(pool: list[PoolFundRow], *, seed: str) -> list[PoolFundRow]:
    if len(pool) <= FUNDS_FOR_YOU_COUNT:
        return pool[:FUNDS_FOR_YOU_COUNT]

    anchors = sorted((row for row in pool if row.is_anchor), key=lambda row: row.sort_order)
    non_anchors = sorted((row for row in pool if not row.is_anchor), key=lambda row: row.sort_order)
    rng = seeded_rng(seed)
    shuffled_non_anchors = non_anchors[:]
    rng.shuffle(shuffled_non_anchors)
    ordered = anchors + shuffled_non_anchors

    picked: list[PoolFundRow] = []
    seen_amc: set[int] = set()
    for row in ordered:
        if row.amc_id in seen_amc:
            continue
        picked.append(row)
        seen_amc.add(row.amc_id)
        if len(picked) == FUNDS_FOR_YOU_COUNT:
            break

    if len(picked) < FUNDS_FOR_YOU_COUNT:
        for row in ordered:
            if row in picked:
                continue
            picked.append(row)
            if len(picked) == FUNDS_FOR_YOU_COUNT:
                break

    return picked[:FUNDS_FOR_YOU_COUNT]


def _pool_fund_to_allocation_input(row: PoolFundRow) -> dict[str, Any]:
    return {
        "allocation_weight_pct": row.allocation_weight_pct,
        "primary_category_slug": row.primary_category_slug,
    }


def _serialize_fund_row(row: PoolFundRow) -> dict[str, Any]:
    return {
        "product_id": str(row.product_id),
        "fund_id": row.fund_id,
        "scheme_name": row.scheme_name,
        "amc_name": row.amc_name,
        "amc_logo_url": row.amc_logo_url,
        "amc_slug": row.amc_slug,
        "min_lumpsum_amount_inr": row.min_lumpsum_amount_inr,
    }


async def _upsert_snapshot(
    session: AsyncSession,
    *,
    user_id: UUID,
    tier: RiskTier,
    basket: RecommendationBasket,
    config_version: int,
    fund_product_ids: list[str],
    allocation_slices: list[dict[str, Any]],
) -> None:
    snapshot = await session.get(UserRecommendationSnapshot, user_id)
    if snapshot is None:
        snapshot = UserRecommendationSnapshot(
            user_id=user_id,
            tier=tier,
            basket_id=basket.id,
            config_version=config_version,
            fund_product_ids=fund_product_ids,
            allocation_slices=allocation_slices,
        )
        session.add(snapshot)
    else:
        snapshot.tier = tier
        snapshot.basket_id = basket.id
        snapshot.config_version = config_version
        snapshot.fund_product_ids = fund_product_ids
        snapshot.allocation_slices = allocation_slices
    await session.flush()


async def load_basket_name(session: AsyncSession, basket_id: UUID) -> str | None:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        return None
    return (basket.portfolio_display_name or basket.name or basket.slug or "").strip() or None


def _public_basket_name(basket: RecommendationBasket) -> str:
    return (basket.portfolio_display_name or basket.name or basket.slug or "").strip()


async def _load_user_lumpsum_cart_product_ids(session: AsyncSession, *, user_id: UUID) -> set[str]:
    items = await list_cart_items(session, user_id=user_id)
    return {
        str(item.product_id)
        for item in items
        if item.investment_type == MfCartInvestmentType.lumpsum
    }


async def _load_user_portfolio_product_ids(session: AsyncSession, *, user_id: UUID) -> set[str]:
    payload = await list_user_portfolio_holdings(session, user_id=user_id)
    isins = {
        str(row.get("isin") or "").upper()
        for row in payload.get("holdings") or []
        if row.get("isin")
    }
    if not isins:
        return set()

    result = await session.execute(
        select(MutualFund.isin_growth, MutualFund.isin_div_reinvestment, Product.id)
        .join(Product, Product.id == MutualFund.product_id)
        .where(mutual_fund_isin_in(isins))
    )

    product_ids: set[str] = set()
    for isin_growth, isin_div, product_id in result.all():
        for isin in matching_fund_isins(
            isin_growth=isin_growth,
            isin_div_reinvestment=isin_div,
            requested=isins,
        ):
            if isin in isins:
                product_ids.add(str(product_id))
    return product_ids


async def _enrich_success_payload(
    session: AsyncSession,
    *,
    user_id: UUID,
    basket: RecommendationBasket | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if not payload.get("eligible"):
        return payload

    cart_product_ids = await _load_user_lumpsum_cart_product_ids(session, user_id=user_id)
    portfolio_product_ids = await _load_user_portfolio_product_ids(session, user_id=user_id)

    enriched_funds: list[dict[str, Any]] = []
    for fund in payload.get("funds") or []:
        product_id = str(fund.get("product_id") or "")
        in_cart = product_id in cart_product_ids
        in_portfolio = product_id in portfolio_product_ids
        enriched_funds.append(
            {
                **fund,
                "in_cart": in_cart,
                "in_portfolio": in_portfolio,
            }
        )

    portfolio_story = None
    if basket is not None:
        portfolio_story = build_portfolio_story(
            basket=basket,
            tier=payload.get("tier"),
            allocation_slices=payload.get("allocation") or [],
        )

    return {
        **payload,
        "funds": enriched_funds,
        "portfolio_story": portfolio_story,
    }
