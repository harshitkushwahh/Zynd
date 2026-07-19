from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.invest_catalog_cache import invalidate_invest_catalog_cache

logger = logging.getLogger(__name__)


async def notify_invest_catalog_changed(
    session: AsyncSession | None = None,
    *,
    refresh_search_vectors: bool = False,
) -> None:
    """Bump invest cache generation and optionally rebuild search vectors."""
    generation = await invalidate_invest_catalog_cache()
    if refresh_search_vectors and session is not None:
        from app.application.mf.invest_search_service import refresh_product_search_vectors

        count = await refresh_product_search_vectors(session)
        logger.info(
            "Invest catalog search vectors refreshed (products=%s, cache_gen=%s)",
            count,
            generation,
        )
