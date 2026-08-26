"""Unified admin search — scoped queries with Redis result caching."""

from __future__ import annotations

import time
from typing import Any, Callable, Awaitable

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_search_cache import (
    build_admin_search_cache_key,
    get_cached_admin_search,
    set_cached_admin_search,
)
from app.application.admin.referral_admin_service import (
    list_admin_referral_attributions,
    list_admin_referral_leaderboard,
)
from app.application.referral.referral_leaderboard_service import resolve_leaderboard_period_range
from app.application.referral.referral_reward_service import list_admin_referrers_directory, list_referral_reward_ledger
from app.core.config import get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralStage
from app.infrastructure.persistence.referral_reward_models import (
    ReferralRewardLedgerStatus,
    ReferralRewardRule,
)

ScopeHandler = Callable[..., Awaitable[tuple[list[dict[str, Any]], int]]]

SCOPE_PERMISSIONS: dict[str, str] = {
    "users": "users.read",
    "referrals.referrers": "referrals.read",
    "referrals.attributions": "referrals.read",
    "referrals.redemptions": "referrals.read",
    "referrals.reward_rules": "referrals.read",
    "referrals.leaderboard": "referrals.read",
}

DEFAULT_SCOPES: tuple[str, ...] = tuple(SCOPE_PERMISSIONS.keys())


def _parse_stage(value: str | None) -> ReferralStage | None:
    if not value or value in {"all", "pending"}:
        return None
    try:
        return ReferralStage(value)
    except ValueError:
        return None


def _parse_ledger_status(value: str | None) -> ReferralRewardLedgerStatus | None:
    if not value or value == "all":
        return None
    try:
        return ReferralRewardLedgerStatus(value)
    except ValueError:
        return None


def _filters_cache_key(**filters: Any) -> str:
    parts = [f"{key}={value}" for key, value in sorted(filters.items()) if value not in (None, "", "all")]
    return "|".join(parts)


async def _search_users(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    from app.application.admin.user_admin_service import (
        _display_name,
        _invested_user_ids,
        _kyc_compliant_user_ids,
    )
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    normalized = query.strip()
    stmt = select(User)
    if normalized:
        term = f"%{normalized}%"
        stmt = stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            )
        )
    total = int((await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one())
    users = list(
        (
            await db.execute(
                stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
            )
        ).scalars()
    )
    user_ids = [user.id for user in users]
    invested_ids = await _invested_user_ids(db, user_ids)
    kyc_ids = await _kyc_compliant_user_ids(db, user_ids)
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    items = [
        {
            "user_id": str(user.id),
            "client_id": user.client_id,
            "email": user.email,
            "display_name": _display_name(user),
            "profile_image_url": profile_images.get(user.id),
            "status": user.status.value,
            "role": user.role.value,
            "has_invested": user.id in invested_ids,
            "kyc_compliant": user.id in kyc_ids,
            "suspended_at": user.suspended_at,
            "mfa_enrolled": user.mfa_enrolled_at is not None,
            "created_at": user.created_at,
        }
        for user in users
    ]
    return items, total


async def _search_referral_referrers(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    items = await list_admin_referrers_directory(
        db,
        search=query.strip() or None,
        limit=limit,
        offset=offset,
    )
    return items, len(items)


async def _search_referral_attributions(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    stage: str | None = None,
    pending_only: bool = False,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    parsed_stage = _parse_stage(stage)
    items = await list_admin_referral_attributions(
        db,
        stage=parsed_stage,
        search=query.strip() or None,
        pending_only=pending_only or stage == "pending",
        limit=limit,
        offset=offset,
    )
    return items, len(items)


async def _search_referral_redemptions(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    status: str | None = None,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    items = await list_referral_reward_ledger(
        db,
        status=_parse_ledger_status(status),
        search=query.strip() or None,
        limit=limit,
        offset=offset,
    )
    return items, len(items)


async def _search_referral_reward_rules(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(ReferralRewardRule).order_by(
        ReferralRewardRule.sort_order.asc(),
        ReferralRewardRule.created_at.asc(),
    )
    normalized = query.strip()
    if normalized:
        term = f"%{normalized}%"
        stmt = stmt.where(
            or_(
                ReferralRewardRule.name.ilike(term),
                ReferralRewardRule.description.ilike(term),
            )
        )
    rules = list((await db.execute(stmt)).scalars())
    total = len(rules)
    page = rules[offset : offset + limit]
    items = [
        {
            "id": str(rule.id),
            "name": rule.name,
            "description": rule.description,
            "trigger": rule.trigger.value,
            "reward_type": rule.reward_type.value,
            "reward_value": rule.reward_value,
            "min_investment_inr": rule.min_investment_inr,
            "valid_from": rule.valid_from,
            "valid_to": rule.valid_to,
            "is_active": rule.is_active,
            "sort_order": rule.sort_order,
        }
        for rule in page
    ]
    return items, total


async def _search_referral_leaderboard(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
    offset: int,
    period: str | None = None,
    **_filters: Any,
) -> tuple[list[dict[str, Any]], int]:
    period_key = period or "this_month"
    await resolve_leaderboard_period_range(db, period_key)
    items = await list_admin_referral_leaderboard(db, period=period_key, limit=500)
    normalized = query.strip().lower()
    if normalized:
        items = [
            item
            for item in items
            if normalized
            in " ".join(
                filter(
                    None,
                    [
                        item.get("display_name"),
                        (item.get("user") or {}).get("email"),
                        (item.get("user") or {}).get("client_id"),
                        item.get("referral_code"),
                    ],
                )
            ).lower()
        ]
    total = len(items)
    return items[offset : offset + limit], total


SCOPE_HANDLERS: dict[str, ScopeHandler] = {
    "users": _search_users,
    "referrals.referrers": _search_referral_referrers,
    "referrals.attributions": _search_referral_attributions,
    "referrals.redemptions": _search_referral_redemptions,
    "referrals.reward_rules": _search_referral_reward_rules,
    "referrals.leaderboard": _search_referral_leaderboard,
}


def _allowed_scopes(permissions: set[str], requested: list[str] | None) -> list[str]:
    scopes = requested or list(DEFAULT_SCOPES)
    allowed: list[str] = []
    for scope in scopes:
        if scope not in SCOPE_PERMISSIONS:
            continue
        if SCOPE_PERMISSIONS[scope] in permissions:
            allowed.append(scope)
    return allowed


async def search_admin_scope(
    db: AsyncSession,
    *,
    scope: str,
    query: str = "",
    limit: int = 50,
    offset: int = 0,
    permissions: set[str],
    use_cache: bool = True,
    **filters: Any,
) -> dict[str, Any]:
    if scope not in SCOPE_HANDLERS:
        raise ValueError(f"Unknown search scope: {scope}")
    required = SCOPE_PERMISSIONS[scope]
    if required not in permissions:
        raise PermissionError(f"Missing permission: {required}")

    settings = get_settings()
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    filters_key = _filters_cache_key(**filters)
    cache_key = await build_admin_search_cache_key(
        scope=scope,
        query=query,
        limit=limit,
        offset=offset,
        filters_key=filters_key,
        settings=settings,
    )

    if use_cache and settings.admin_search_cache_enabled:
        cached = await get_cached_admin_search(cache_key, settings=settings)
        if cached is not None:
            cached["cached"] = True
            return cached

    started = time.perf_counter()
    handler = SCOPE_HANDLERS[scope]
    items, total = await handler(db, query=query, limit=limit, offset=offset, **filters)
    took_ms = int((time.perf_counter() - started) * 1000)

    payload = {
        "query": query.strip(),
        "scope": scope,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
        "took_ms": took_ms,
        "cached": False,
    }
    await set_cached_admin_search(cache_key, payload, settings=settings)
    return payload


async def search_admin(
    db: AsyncSession,
    *,
    query: str = "",
    scopes: list[str] | None = None,
    limit: int = 20,
    offset: int = 0,
    permissions: set[str],
    **filters: Any,
) -> dict[str, Any]:
    allowed = _allowed_scopes(permissions, scopes)
    if not allowed:
        return {
            "query": query.strip(),
            "scope": None,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "groups": [],
            "took_ms": 0,
            "cached": False,
        }

    if len(allowed) == 1:
        return await search_admin_scope(
            db,
            scope=allowed[0],
            query=query,
            limit=limit,
            offset=offset,
            permissions=permissions,
            **filters,
        )

    started = time.perf_counter()
    groups: list[dict[str, Any]] = []
    per_scope_limit = max(min(limit, 10), 1)
    for scope in allowed:
        try:
            result = await search_admin_scope(
                db,
                scope=scope,
                query=query,
                limit=per_scope_limit,
                offset=0,
                permissions=permissions,
                **filters,
            )
        except PermissionError:
            continue
        if result["items"]:
            groups.append(
                {
                    "scope": scope,
                    "total": result["total"],
                    "items": result["items"],
                }
            )

    took_ms = int((time.perf_counter() - started) * 1000)
    return {
        "query": query.strip(),
        "scope": None,
        "total": sum(group["total"] for group in groups),
        "limit": limit,
        "offset": offset,
        "groups": groups,
        "took_ms": took_ms,
        "cached": False,
    }
