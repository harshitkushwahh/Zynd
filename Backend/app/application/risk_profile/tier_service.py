from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.display import display_score, split_tier_message
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskTier, RiskTierConfig

DEFAULT_TIERS: list[dict[str, Any]] = [
    {
        "tier": RiskTier.secure,
        "min_score": 0,
        "max_score": 199,
        "title": "Secure",
        "message_body": "Your risk profile is Secure. We recommend capital-preservation focused investments.",
        "sort_order": 1,
    },
    {
        "tier": RiskTier.conservative,
        "min_score": 200,
        "max_score": 399,
        "title": "Conservative",
        "message_body": "Your risk profile is Conservative. We recommend stable, low-volatility investments.",
        "sort_order": 2,
    },
    {
        "tier": RiskTier.moderate,
        "min_score": 400,
        "max_score": 599,
        "title": "Moderate",
        "message_body": "Your risk profile is Moderate. We recommend a balanced mix of stability and growth.",
        "sort_order": 3,
    },
    {
        "tier": RiskTier.growth,
        "min_score": 600,
        "max_score": 799,
        "title": "Growth",
        "message_body": "Your risk profile is Growth. We recommend growth-oriented investments with moderate volatility.",
        "sort_order": 4,
    },
    {
        "tier": RiskTier.aggressive,
        "min_score": 800,
        "max_score": 1000,
        "title": "Aggressive",
        "message_body": "Your risk profile is Aggressive. We recommend high-growth investments suited to your risk appetite.",
        "sort_order": 5,
    },
]


def serialize_tier(row: RiskTierConfig) -> dict[str, Any]:
    summary, recommendation = split_tier_message(row.message_body)
    return {
        "tier": row.tier.value,
        "min_score": row.min_score,
        "max_score": row.max_score,
        "display_score": display_score(row.max_score),
        "display_score_min": display_score(row.min_score),
        "display_score_max": display_score(row.max_score),
        "title": row.title,
        "message_body": row.message_body,
        "message_summary": summary,
        "message_recommendation": recommendation,
        "sort_order": row.sort_order,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _tier_snapshot(row: RiskTierConfig) -> dict[str, Any]:
    return {
        "tier": row.tier.value,
        "min_score": row.min_score,
        "max_score": row.max_score,
        "title": row.title,
        "message_body": row.message_body,
        "sort_order": row.sort_order,
    }


def _validate_score_bounds(min_score: int, max_score: int) -> None:
    if min_score < 0 or max_score > 1000:
        raise RiskProfileError("invalid_tier_bounds", "Tier scores must stay within 0 and 1000.")
    if min_score > max_score:
        raise RiskProfileError("invalid_tier_bounds", "Tier min_score cannot exceed max_score.")


async def ensure_risk_tier_seed(db: AsyncSession) -> None:
    for item in DEFAULT_TIERS:
        result = await db.execute(select(RiskTierConfig).where(RiskTierConfig.tier == item["tier"]))
        row = result.scalar_one_or_none()
        if row:
            continue
        db.add(
            RiskTierConfig(
                tier=item["tier"],
                min_score=item["min_score"],
                max_score=item["max_score"],
                title=item["title"],
                message_body=item["message_body"],
                sort_order=item["sort_order"],
            )
        )
    await db.flush()


async def list_tiers(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(select(RiskTierConfig).order_by(RiskTierConfig.sort_order))
    return [serialize_tier(row) for row in result.scalars().all()]


async def get_tier(db: AsyncSession, tier: RiskTier) -> dict[str, Any]:
    result = await db.execute(select(RiskTierConfig).where(RiskTierConfig.tier == tier))
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("tier_not_found", "Risk tier configuration not found.", status_code=404)
    return serialize_tier(row)


async def update_tier(
    db: AsyncSession,
    *,
    tier: RiskTier,
    min_score: int | None,
    max_score: int | None,
    title: str | None,
    message_body: str | None,
    sort_order: int | None,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    result = await db.execute(select(RiskTierConfig).where(RiskTierConfig.tier == tier))
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("tier_not_found", "Risk tier configuration not found.", status_code=404)

    before = _tier_snapshot(row)
    next_min = row.min_score if min_score is None else min_score
    next_max = row.max_score if max_score is None else max_score
    _validate_score_bounds(next_min, next_max)

    all_tiers = await list_tiers(db)
    for other in all_tiers:
        if other["tier"] == tier.value:
            continue
        overlap = not (next_max < other["min_score"] or next_min > other["max_score"])
        if overlap:
            raise RiskProfileError(
                "tier_bounds_overlap",
                f"Updated bounds overlap with the {other['tier']} tier.",
            )

    row.min_score = next_min
    row.max_score = next_max

    if title is not None:
        trimmed_title = title.strip()
        if not trimmed_title:
            raise RiskProfileError("invalid_tier_title", "Tier title cannot be empty.")
        row.title = trimmed_title

    if message_body is not None:
        trimmed_message = message_body.strip()
        if not trimmed_message:
            raise RiskProfileError("invalid_tier_message", "Tier message cannot be empty.")
        row.message_body = trimmed_message

    if sort_order is not None:
        row.sort_order = sort_order

    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.risk_tier_config_updated,
        user_id=admin.id,
        ip=ip,
        metadata={
            "tier": tier.value,
            "before": before,
            "after": _tier_snapshot(row),
            "admin_id": str(admin.id),
        },
    )
    return serialize_tier(row)


async def resolve_tier_for_score(db: AsyncSession, score: int) -> RiskTierConfig:
    clamped = max(0, min(1000, score))
    result = await db.execute(
        select(RiskTierConfig)
        .where(RiskTierConfig.min_score <= clamped, RiskTierConfig.max_score >= clamped)
        .order_by(RiskTierConfig.sort_order)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("tier_not_resolved", "No risk tier matches the computed score.")
    return row
