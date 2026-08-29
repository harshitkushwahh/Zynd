from __future__ import annotations

import re
import uuid
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.recommendations.errors import RecommendationError
from app.application.recommendations.funds_for_you_service import (
    count_investable_basket_funds,
    get_published_version,
    preview_for_user,
)
from app.application.recommendations.publish_readiness import get_publish_readiness
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product
from app.infrastructure.persistence.models import AuditEventType
from app.infrastructure.persistence.recommendation_models import (
    PortfolioRole,
    RecommendationBasket,
    RecommendationBasketFund,
    RecommendationConfig,
)
from app.infrastructure.persistence.risk_profile_models import RiskTier

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    slug = _SLUG_RE.sub("-", value.strip().lower()).strip("-")
    return slug or "basket"


async def _ensure_unique_slug(session: AsyncSession, tier: RiskTier, base_slug: str) -> str:
    candidate = base_slug
    suffix = 2
    while True:
        existing = await session.scalar(
            select(RecommendationBasket.id).where(
                RecommendationBasket.tier == tier,
                RecommendationBasket.slug == candidate,
            )
        )
        if not existing:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def serialize_basket(row: RecommendationBasket, *, fund_count: int = 0, investable_count: int = 0) -> dict[str, Any]:
    display_name = (row.portfolio_display_name or row.name or row.slug or "").strip()
    return {
        "id": str(row.id),
        "tier": row.tier.value,
        "slug": row.slug,
        "name": row.name,
        "display_name": display_name,
        "description": row.description,
        "objective_summary": row.objective_summary,
        "portfolio_display_name": row.portfolio_display_name,
        "target_allocation": row.target_allocation,
        "is_active": row.is_active,
        "sort_order": row.sort_order,
        "fund_count": fund_count,
        "investable_fund_count": investable_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def serialize_basket_fund(link: RecommendationBasketFund, *, hydrated: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "id": str(link.id),
        "product_id": str(link.product_id),
        "sort_order": link.sort_order,
        "allocation_weight_pct": float(link.allocation_weight_pct) if link.allocation_weight_pct is not None else None,
        "portfolio_role": link.portfolio_role.value if link.portfolio_role else None,
        "is_anchor": link.is_anchor,
        "is_alternative": link.is_alternative,
        "alternative_for_product_id": str(link.alternative_for_product_id)
        if link.alternative_for_product_id
        else None,
        "is_active": link.is_active,
    }
    if hydrated:
        payload.update(hydrated)
    return payload


async def _hydrate_basket_fund_rows(
    session: AsyncSession,
    links: list[RecommendationBasketFund],
) -> list[dict[str, Any]]:
    if not links:
        return []

    product_ids = [link.product_id for link in links]
    result = await session.execute(
        select(Product, MutualFund, FundAmc)
        .join(MutualFund, MutualFund.product_id == Product.id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .where(Product.id.in_(product_ids))
    )
    catalog_by_product = {
        product.id: {
            "fund_id": fund.id,
            "scheme_name": fund.scheme_name,
            "amc_name": amc.name,
            "amc_slug": amc.slug,
            "amc_logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug),
            "lifecycle_status": product.lifecycle_status.value if product.lifecycle_status else None,
            "fund_active": fund.is_active,
            "amc_empanelled": amc.is_active,
        }
        for product, fund, amc in result.all()
    }

    return [
        serialize_basket_fund(
            link,
            hydrated=catalog_by_product.get(
                link.product_id,
                {
                    "fund_id": None,
                    "scheme_name": None,
                    "amc_name": None,
                    "amc_slug": None,
                    "amc_logo_url": None,
                    "lifecycle_status": None,
                    "fund_active": None,
                    "amc_empanelled": None,
                },
            ),
        )
        for link in links
    ]


async def _fund_counts(session: AsyncSession, basket_id: UUID) -> tuple[int, int]:
    total = await session.scalar(
        select(func.count())
        .select_from(RecommendationBasketFund)
        .where(
            RecommendationBasketFund.basket_id == basket_id,
            RecommendationBasketFund.is_active.is_(True),
        )
    )
    investable = await count_investable_basket_funds(session, basket_id)
    return int(total or 0), investable


async def list_baskets(session: AsyncSession, *, tier: RiskTier | None = None) -> list[dict[str, Any]]:
    query = select(RecommendationBasket).order_by(
        RecommendationBasket.tier,
        RecommendationBasket.sort_order,
        RecommendationBasket.created_at,
    )
    if tier is not None:
        query = query.where(RecommendationBasket.tier == tier)
    result = await session.execute(query)
    rows = list(result.scalars().all())
    serialized: list[dict[str, Any]] = []
    for row in rows:
        fund_count, investable_count = await _fund_counts(session, row.id)
        serialized.append(serialize_basket(row, fund_count=fund_count, investable_count=investable_count))
    return serialized


async def get_basket(session: AsyncSession, basket_id: UUID) -> dict[str, Any] | None:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        return None
    fund_count, investable_count = await _fund_counts(session, basket.id)
    funds_result = await session.execute(
        select(RecommendationBasketFund)
        .where(RecommendationBasketFund.basket_id == basket.id)
        .order_by(RecommendationBasketFund.sort_order, RecommendationBasketFund.created_at)
    )
    funds = await _hydrate_basket_fund_rows(session, list(funds_result.scalars().all()))
    await session.refresh(basket)
    payload = serialize_basket(basket, fund_count=fund_count, investable_count=investable_count)
    payload["funds"] = funds
    return payload


async def create_basket(
    session: AsyncSession,
    *,
    admin_user_id: UUID,
    tier: RiskTier,
    name: str | None = None,
    slug: str | None = None,
    description: str | None = None,
    objective_summary: str | None = None,
    portfolio_display_name: str | None = None,
    target_allocation: dict | None = None,
    sort_order: int = 0,
) -> dict[str, Any]:
    display = (portfolio_display_name or name or "").strip()
    if not display:
        raise RecommendationError(
            "invalid_basket_display_name",
            "Basket display name is required.",
            status_code=400,
        )

    base_slug = _slugify(slug or display)
    normalized_slug = await _ensure_unique_slug(session, tier, base_slug)

    basket = RecommendationBasket(
        tier=tier,
        slug=normalized_slug,
        name=normalized_slug,
        description=description,
        objective_summary=objective_summary,
        portfolio_display_name=display,
        target_allocation=target_allocation,
        sort_order=sort_order,
        is_active=True,
    )
    session.add(basket)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_created,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket.id), "tier": tier.value, "slug": basket.slug},
    )
    await session.refresh(basket)
    return serialize_basket(basket)


async def update_basket(
    session: AsyncSession,
    basket_id: UUID,
    *,
    admin_user_id: UUID,
    name: str | None = None,
    description: str | None = None,
    objective_summary: str | None = None,
    portfolio_display_name: str | None = None,
    target_allocation: dict | None = None,
    is_active: bool | None = None,
    sort_order: int | None = None,
) -> dict[str, Any]:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        raise RecommendationError("basket_not_found", "Recommendation basket not found.", status_code=404)

    if name is not None:
        basket.name = name.strip()
    if description is not None:
        basket.description = description
    if objective_summary is not None:
        basket.objective_summary = objective_summary
    if portfolio_display_name is not None:
        basket.portfolio_display_name = portfolio_display_name
    if target_allocation is not None:
        basket.target_allocation = target_allocation
    if is_active is not None:
        basket.is_active = is_active
    if sort_order is not None:
        basket.sort_order = sort_order

    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_updated,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket.id)},
    )
    detail = await get_basket(session, basket_id)
    assert detail is not None
    return detail


async def delete_basket(
    session: AsyncSession,
    basket_id: UUID,
    *,
    admin_user_id: UUID,
) -> None:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        raise RecommendationError("basket_not_found", "Recommendation basket not found.", status_code=404)
    basket.is_active = False
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_deleted,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket.id), "soft_delete": True},
    )


async def replace_basket_funds(
    session: AsyncSession,
    basket_id: UUID,
    *,
    admin_user_id: UUID,
    funds: list[dict[str, Any]],
) -> dict[str, Any]:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        raise RecommendationError("basket_not_found", "Recommendation basket not found.", status_code=404)

    existing = await session.execute(
        select(RecommendationBasketFund).where(RecommendationBasketFund.basket_id == basket_id)
    )
    for link in existing.scalars().all():
        await session.delete(link)
    await session.flush()

    for index, fund in enumerate(funds):
        portfolio_role = fund.get("portfolio_role")
        link = RecommendationBasketFund(
            basket_id=basket_id,
            product_id=UUID(str(fund["product_id"])),
            sort_order=int(fund.get("sort_order", index)),
            allocation_weight_pct=(
                Decimal(str(fund["allocation_weight_pct"]))
                if fund.get("allocation_weight_pct") is not None
                else None
            ),
            portfolio_role=PortfolioRole(portfolio_role) if portfolio_role else None,
            is_anchor=bool(fund.get("is_anchor", False)),
            is_alternative=bool(fund.get("is_alternative", False)),
            alternative_for_product_id=(
                UUID(str(fund["alternative_for_product_id"]))
                if fund.get("alternative_for_product_id")
                else None
            ),
            is_active=bool(fund.get("is_active", True)),
        )
        session.add(link)

    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_funds_replaced,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket_id), "fund_count": len(funds)},
    )
    detail = await get_basket(session, basket_id)
    assert detail is not None
    return detail


async def add_basket_fund(
    session: AsyncSession,
    basket_id: UUID,
    *,
    admin_user_id: UUID,
    product_id: UUID,
    sort_order: int | None = None,
) -> dict[str, Any]:
    basket = await session.get(RecommendationBasket, basket_id)
    if not basket:
        raise RecommendationError("basket_not_found", "Recommendation basket not found.", status_code=404)

    existing = await session.scalar(
        select(RecommendationBasketFund.id).where(
            RecommendationBasketFund.basket_id == basket_id,
            RecommendationBasketFund.product_id == product_id,
        )
    )
    if existing:
        raise RecommendationError("fund_already_in_basket", "Fund already exists in basket.", status_code=409)

    if sort_order is None:
        max_sort = await session.scalar(
            select(func.max(RecommendationBasketFund.sort_order)).where(
                RecommendationBasketFund.basket_id == basket_id
            )
        )
        sort_order = int(max_sort or -1) + 1

    link = RecommendationBasketFund(
        basket_id=basket_id,
        product_id=product_id,
        sort_order=sort_order,
    )
    session.add(link)
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_funds_replaced,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket_id), "product_id": str(product_id), "action": "add"},
    )
    detail = await get_basket(session, basket_id)
    assert detail is not None
    return detail


async def remove_basket_fund(
    session: AsyncSession,
    basket_id: UUID,
    product_id: UUID,
    *,
    admin_user_id: UUID,
) -> dict[str, Any]:
    link = await session.scalar(
        select(RecommendationBasketFund).where(
            RecommendationBasketFund.basket_id == basket_id,
            RecommendationBasketFund.product_id == product_id,
        )
    )
    if not link:
        raise RecommendationError("fund_not_in_basket", "Fund not found in basket.", status_code=404)
    await session.delete(link)
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.recommendation_basket_funds_replaced,
        user_id=admin_user_id,
        metadata={"basket_id": str(basket_id), "product_id": str(product_id), "action": "remove"},
    )
    detail = await get_basket(session, basket_id)
    assert detail is not None
    return detail


async def get_config(session: AsyncSession) -> dict[str, Any]:
    row = await session.get(RecommendationConfig, 1)
    if not row:
        return {"published_version": 0, "published_at": None, "published_by": None}
    return {
        "published_version": row.published_version,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "published_by": str(row.published_by) if row.published_by else None,
    }


async def publish_config(session: AsyncSession, *, admin_user_id: UUID) -> dict[str, Any]:
    readiness = await get_publish_readiness(session)
    if not readiness["can_publish"]:
        first_issue = readiness["issues"][0] if readiness["issues"] else None
        message = (
            first_issue["message"]
            if isinstance(first_issue, dict) and first_issue.get("message")
            else "Recommendation configuration is not ready to publish."
        )
        raise RecommendationError("publish_blocked", message, status_code=409)

    row = await session.get(RecommendationConfig, 1)
    if not row:
        row = RecommendationConfig(id=1, published_version=0)
        session.add(row)
        await session.flush()

    row.published_version = int(row.published_version) + 1
    from datetime import datetime, timezone

    row.published_at = datetime.now(timezone.utc)
    row.published_by = admin_user_id
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.recommendation_config_published,
        user_id=admin_user_id,
        metadata={"published_version": row.published_version},
    )
    return await get_config(session)


async def preview_selection(
    session: AsyncSession,
    *,
    tier: RiskTier,
    sample_user_id: UUID,
) -> dict[str, Any]:
    return await preview_for_user(session, user_id=sample_user_id, tier=tier)
