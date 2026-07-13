from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_health_service import get_catalog_health
from app.application.mf.invest_catalog_cache import get_invest_cache_stats
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    IngestionRunLog,
    IngestionRunStatus,
    Product,
    ProductLifecycleStatus,
    ProductType,
)
from app.infrastructure.persistence.mf_transaction_models import MfOrder


async def collect_catalog_prometheus_stats(session: AsyncSession) -> dict[str, float | int]:
    settings = get_settings()
    health = await get_catalog_health(session)

    active_products = int(
        await session.scalar(
            select(func.count())
            .select_from(Product)
            .where(
                Product.product_type == ProductType.mutual_fund,
                Product.lifecycle_status == ProductLifecycleStatus.active,
            )
        )
        or 0
    )
    total_products = int(
        await session.scalar(
            select(func.count())
            .select_from(Product)
            .where(Product.product_type == ProductType.mutual_fund)
        )
        or 0
    )
    stale_nav_funds = int(health.get("summary", {}).get("stale_nav", 0))

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    orders_24h = int(
        await session.scalar(
            select(func.count()).select_from(MfOrder).where(MfOrder.created_at >= since)
        )
        or 0
    )

    nav_job = (
        await session.execute(
            select(IngestionRunLog)
            .where(IngestionRunLog.job_name == "amfi-nav-daily", IngestionRunLog.finished_at.is_not(None))
            .order_by(IngestionRunLog.finished_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    nav_job_success = 1 if nav_job and nav_job.status == IngestionRunStatus.succeeded else 0
    nav_job_failed = 1 if nav_job and nav_job.status == IngestionRunStatus.failed else 0

    cache_stats = await get_invest_cache_stats()
    hits = cache_stats["hits"]
    misses = cache_stats["misses"]
    total_cache = hits + misses
    hit_rate = (hits / total_cache) if total_cache else 0.0

    zero_active_alert = 1 if active_products == 0 and total_products > 0 else 0

    return {
        "active_products": active_products,
        "total_products": total_products,
        "stale_nav_funds": stale_nav_funds,
        "orders_24h": orders_24h,
        "nav_job_success": nav_job_success,
        "nav_job_failed": nav_job_failed,
        "cache_hits": hits,
        "cache_misses": misses,
        "cache_hit_rate": hit_rate,
        "zero_active_funds_alert": zero_active_alert,
        "catalog_health_gates_enabled": 1 if settings.zynd_mf_catalog_health_gates_enabled else 0,
    }
