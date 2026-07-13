from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.collection_definitions import CAP_COLLECTION_BY_BUCKET, COLLECTION_SLUGS
from app.application.mf.collection_return_score import has_minimum_return_history, weighted_return_score
from app.application.mf.fund_classifier import matches_gold_silver_collection
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    CategoryKind,
    FundAmc,
    FundDerivedAttributes,
    FundNavMetrics,
    IngestionRunStatus,
    MutualFund,
    Product,
    ProductCategory,
)

logger = logging.getLogger(__name__)


def _is_sip_eligible(fund: MutualFund) -> bool:
    constraints = fund.investment_constraints or {}
    transaction_types = constraints.get("transaction_types") or []
    if "sip" in transaction_types:
        return True
    return fund.min_sip_amount is not None and fund.min_sip_amount > 0


def _min_sip_inr(fund: MutualFund) -> Decimal:
    if fund.min_sip_amount is not None:
        return Decimal(str(fund.min_sip_amount))
    constraints = fund.investment_constraints or {}
    for option in constraints.get("sip_options") or []:
        min_inr = option.get("min_inr")
        if min_inr is not None:
            return Decimal(str(min_inr))
    return Decimal("999999")


class _EligibleFund:
    __slots__ = (
        "fund_id",
        "product_id",
        "scheme_name",
        "sebi_category",
        "fund",
        "metrics",
        "cap_bucket",
        "theme_tags",
        "return_score",
    )

    def __init__(
        self,
        *,
        fund_id: int,
        product_id: uuid.UUID,
        scheme_name: str,
        sebi_category: str | None,
        fund: MutualFund,
        metrics: FundNavMetrics | None,
        cap_bucket: str | None,
        theme_tags: list,
        return_score: Decimal | None,
    ) -> None:
        self.fund_id = fund_id
        self.product_id = product_id
        self.scheme_name = scheme_name
        self.sebi_category = sebi_category
        self.fund = fund
        self.metrics = metrics
        self.cap_bucket = cap_bucket
        self.theme_tags = theme_tags
        self.return_score = return_score


async def _load_collection_category_ids(session: AsyncSession) -> dict[str, int]:
    rows = (
        await session.execute(
            select(Category.slug, Category.id).where(
                Category.category_kind == CategoryKind.collection,
                Category.slug.in_(COLLECTION_SLUGS),
            )
        )
    ).all()
    return {slug: category_id for slug, category_id in rows}


async def _load_eligible_funds(session: AsyncSession) -> list[_EligibleFund]:
    rows = (
        await session.execute(
            select(
                MutualFund,
                Product,
                FundNavMetrics,
                FundDerivedAttributes.cap_bucket,
                FundDerivedAttributes.theme_tags,
            )
            .join(Product, Product.id == MutualFund.product_id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .outerjoin(FundDerivedAttributes, FundDerivedAttributes.fund_id == MutualFund.id)
            .where(invest_visibility_sql_clause())
        )
    ).all()

    eligible: list[_EligibleFund] = []
    for fund, product, metrics, cap_bucket, theme_tags in rows:
        if product.id is None:
            continue
        eligible.append(
            _EligibleFund(
                fund_id=fund.id,
                product_id=product.id,
                scheme_name=fund.scheme_name,
                sebi_category=fund.sebi_category,
                fund=fund,
                metrics=metrics,
                cap_bucket=cap_bucket,
                theme_tags=list(theme_tags or []),
                return_score=weighted_return_score(metrics),
            )
        )
    return eligible


def _assign_cap_collections(funds: list[_EligibleFund]) -> dict[str, list[uuid.UUID]]:
    assignments: dict[str, list[uuid.UUID]] = {slug: [] for slug in CAP_COLLECTION_BY_BUCKET.values()}
    for entry in funds:
        if not entry.cap_bucket:
            continue
        slug = CAP_COLLECTION_BY_BUCKET.get(entry.cap_bucket)
        if slug:
            assignments[slug].append(entry.product_id)
    return assignments


def _assign_gold_silver(funds: list[_EligibleFund]) -> list[uuid.UUID]:
    product_ids: list[uuid.UUID] = []
    for entry in funds:
        if matches_gold_silver_collection(
            scheme_name=entry.scheme_name,
            sebi_category=entry.sebi_category,
            theme_tags=entry.theme_tags,
        ):
            product_ids.append(entry.product_id)
    return product_ids


def _assign_high_return(funds: list[_EligibleFund], *, top_n: int) -> list[uuid.UUID]:
    ranked = [
        entry
        for entry in funds
        if entry.return_score is not None and has_minimum_return_history(entry.metrics)
    ]
    ranked.sort(key=lambda item: item.return_score or Decimal("-999999"), reverse=True)
    return [entry.product_id for entry in ranked[:top_n]]


def _assign_best_sip(
    funds: list[_EligibleFund],
    *,
    top_n: int,
    max_min_sip_inr: Decimal,
) -> list[uuid.UUID]:
    candidates = [
        entry
        for entry in funds
        if _is_sip_eligible(entry.fund)
        and _min_sip_inr(entry.fund) <= max_min_sip_inr
        and entry.return_score is not None
        and has_minimum_return_history(entry.metrics)
    ]
    candidates.sort(
        key=lambda item: (
            -(item.return_score or Decimal("-999999")),
            _min_sip_inr(item.fund),
        )
    )
    return [entry.product_id for entry in candidates[:top_n]]


def _build_assignments(
    funds: list[_EligibleFund],
    *,
    top_n: int,
    max_min_sip_inr: Decimal,
) -> dict[str, list[uuid.UUID]]:
    assignments = _assign_cap_collections(funds)
    assignments["gold-silver"] = _assign_gold_silver(funds)
    assignments["high-return"] = _assign_high_return(funds, top_n=top_n)
    assignments["best-sip"] = _assign_best_sip(funds, top_n=top_n, max_min_sip_inr=max_min_sip_inr)
    return assignments


async def run_collection_assign_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_collections_enabled:
        return {"skipped": 1, "reason": "collections_disabled"}

    if await has_running_job(session, "collection-assign-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="collection-assign-sync", triggered_by=triggered_by)
    linked = removed = 0

    try:
        category_ids = await _load_collection_category_ids(session)
        if len(category_ids) != len(COLLECTION_SLUGS):
            missing = sorted(set(COLLECTION_SLUGS) - set(category_ids))
            raise RuntimeError(f"Missing collection categories: {missing}")

        collection_id_values = list(category_ids.values())
        delete_result = await session.execute(
            delete(ProductCategory).where(ProductCategory.category_id.in_(collection_id_values))
        )
        removed = int(delete_result.rowcount or 0)

        funds = await _load_eligible_funds(session)
        assignments = _build_assignments(
            funds,
            top_n=settings.zynd_mf_collection_top_n,
            max_min_sip_inr=Decimal(str(settings.zynd_mf_collection_best_sip_max_min_inr)),
        )

        for slug, product_ids in assignments.items():
            category_id = category_ids[slug]
            for position, product_id in enumerate(product_ids, start=1):
                session.add(
                    ProductCategory(
                        product_id=product_id,
                        category_id=category_id,
                        display_order=position,
                    )
                )
                linked += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=len(funds),
            records_inserted=linked,
            records_skipped=removed,
            metadata={slug: len(ids) for slug, ids in assignments.items()},
        )
        await notify_invest_catalog_changed(session)
        return {
            "processed": len(funds),
            "linked": linked,
            "removed": removed,
            "collections": {slug: len(ids) for slug, ids in assignments.items()},
        }
    except Exception:
        logger.exception("collection-assign-sync failed")
        await finish_ingestion_run(session, run, status=IngestionRunStatus.failed)
        raise
