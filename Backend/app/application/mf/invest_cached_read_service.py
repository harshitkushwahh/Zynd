from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.invest_catalog_cache import (
    build_invest_cache_key,
    get_cached_json,
    set_cached_json,
)
from app.application.mf.invest_home_service import (
    get_invest_config,
    get_invest_fund_detail,
    get_invest_home,
    list_invest_categories,
    list_invest_collections,
    list_invest_funds,
)
from app.application.mf.invest_search_service import search_invest_funds
from app.core.config import get_settings


async def cached_get_invest_home(session: AsyncSession) -> dict:
    settings = get_settings()
    key = await build_invest_cache_key("home")
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await get_invest_home(session)
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_home_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_list_invest_categories(session: AsyncSession) -> list[dict]:
    settings = get_settings()
    key = await build_invest_cache_key("categories")
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await list_invest_categories(session)
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_category_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_list_invest_collections(session: AsyncSession) -> list[dict]:
    settings = get_settings()
    key = await build_invest_cache_key("collections")
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await list_invest_collections(session)
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_category_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_list_invest_funds(
    session: AsyncSession,
    *,
    category_slug: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "rank",
) -> dict:
    settings = get_settings()
    key = await build_invest_cache_key(
        "funds",
        category_slug or "",
        str(page),
        str(page_size),
        sort,
    )
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await list_invest_funds(
        session,
        category_slug=category_slug,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_category_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_get_invest_fund_detail(session: AsyncSession, product_id: uuid.UUID) -> dict | None:
    settings = get_settings()
    key = await build_invest_cache_key("fund", str(product_id))
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await get_invest_fund_detail(session, product_id)
    if payload is None:
        return None
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_fund_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_get_invest_config(session: AsyncSession) -> dict:
    settings = get_settings()
    key = await build_invest_cache_key("config")
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await get_invest_config(session)
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_config_ttl_seconds,
        settings=settings,
    )
    return payload


async def cached_search_invest_funds(
    session: AsyncSession,
    *,
    query: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    settings = get_settings()
    normalized = query.strip().lower()
    key = await build_invest_cache_key("search", normalized, str(page), str(page_size))
    cached = await get_cached_json(key, settings=settings)
    if cached is not None:
        return cached
    payload = await search_invest_funds(session, query=query, page=page, page_size=page_size)
    await set_cached_json(
        key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_search_ttl_seconds,
        settings=settings,
    )
    return payload
