"""Admin referral console queries."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.application.referral.referral_attribution_service import (
    count_engaged_for_referrer,
    count_first_investment_for_referrer,
    count_kyc_verified_for_referrer,
    count_qualified_for_referrer,
    count_signups_for_referrer,
    get_attribution_for_referee,
    list_referrals_for_referrer,
    referral_stage_at_or_beyond,
)
from app.application.referral.referral_code_service import get_referral_code_for_user
from app.application.referral.referral_leaderboard_service import (
    REFERRAL_REWARD_RATE,
    compute_leaderboard_rows,
    display_name_for_user,
    list_leaderboard_from_snapshots,
    resolve_leaderboard_period_range,
)
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    REFERRAL_STAGE_ORDER,
    ReferralAttribution,
    ReferralClick,
    ReferralCode,
    ReferralStage,
)

ReferrerUser = aliased(User)
RefereeUser = aliased(User)


def _user_summary(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    display_name = f"{first} {last}".strip() or user.email.split("@", maxsplit=1)[0]
    return {
        "user_id": str(user.id),
        "client_id": user.client_id,
        "email": user.email,
        "display_name": display_name,
    }


def _estimated_reward_inr(attribution: ReferralAttribution) -> int:
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.first_investment):
        return 0
    if attribution.first_investment_amount_inr is None:
        return 0
    return int(round(attribution.first_investment_amount_inr * REFERRAL_REWARD_RATE))


def _stage_counts_stmt():
    return select(
        ReferralAttribution.current_stage,
        func.count(ReferralAttribution.id),
    ).group_by(ReferralAttribution.current_stage)


async def get_admin_referral_metrics(db: AsyncSession) -> dict[str, Any]:
    total_attributions = int(
        (await db.execute(select(func.count()).select_from(ReferralAttribution))).scalar_one()
    )
    total_referrers = int(
        (
            await db.execute(
                select(func.count(func.distinct(ReferralAttribution.referrer_user_id))).select_from(
                    ReferralAttribution
                )
            )
        ).scalar_one()
    )
    total_clicks = int(
        (await db.execute(select(func.count()).select_from(ReferralClick))).scalar_one()
    )

    stage_counts = {
        row[0].value: int(row[1])
        for row in (await db.execute(_stage_counts_stmt())).all()
    }

    invested_stages = REFERRAL_STAGE_ORDER[
        REFERRAL_STAGE_ORDER.index(ReferralStage.first_investment) :
    ]
    estimated_earnings_inr = int(
        (
            await db.execute(
                select(
                    func.coalesce(
                        func.sum(
                            ReferralAttribution.first_investment_amount_inr * REFERRAL_REWARD_RATE
                        ),
                        0,
                    )
                ).where(ReferralAttribution.current_stage.in_(invested_stages))
            )
        ).scalar_one()
        or 0
    )

    signups = stage_counts.get(ReferralStage.signed_up.value, 0)
    kyc = sum(
        stage_counts.get(stage.value, 0)
        for stage in REFERRAL_STAGE_ORDER
        if referral_stage_at_or_beyond(stage, ReferralStage.kyc_verified)
    )
    invested = sum(
        stage_counts.get(stage.value, 0)
        for stage in REFERRAL_STAGE_ORDER
        if referral_stage_at_or_beyond(stage, ReferralStage.first_investment)
    )
    qualified = sum(
        stage_counts.get(stage.value, 0)
        for stage in REFERRAL_STAGE_ORDER
        if referral_stage_at_or_beyond(stage, ReferralStage.qualified)
    )

    conversion_signup_pct = round((signups / total_clicks) * 100, 1) if total_clicks else 0.0
    conversion_invest_pct = round((invested / total_attributions) * 100, 1) if total_attributions else 0.0

    return {
        "total_clicks": total_clicks,
        "total_attributions": total_attributions,
        "total_referrers": total_referrers,
        "stage_counts": stage_counts,
        "kyc_verified_count": kyc,
        "first_investment_count": invested,
        "qualified_count": qualified,
        "engaged_count": stage_counts.get(ReferralStage.engaged.value, 0),
        "estimated_earnings_inr": estimated_earnings_inr,
        "conversion_click_to_signup_pct": conversion_signup_pct,
        "conversion_signup_to_invest_pct": conversion_invest_pct,
    }


def get_admin_referral_scheme() -> dict[str, Any]:
    settings = get_settings()
    return {
        "reward_rate_pct": round(REFERRAL_REWARD_RATE * 100, 2),
        "min_first_investment_inr": settings.referral_min_first_investment_inr,
        "qualification_hold_days": settings.referral_qualification_hold_days,
        "lumpsum_retention_days": 180,
        "min_referrals_to_redeem": 15,
        "min_engagement_investment_inr": settings.referral_min_engagement_investment_inr,
        "aum_milestone_inr": settings.referral_aum_milestone_inr,
        "stages": [stage.value for stage in REFERRAL_STAGE_ORDER],
        "reward_note": (
            "Rewards follow active categories in the Reward categories tab. "
            "Lumpsum first investments must be retained for 6 months before qualification. "
            "Referrers need at least 15 qualified referrals before redemption."
        ),
    }


async def get_admin_referral_scheme_with_rules(db: AsyncSession) -> dict[str, Any]:
    from app.application.referral.referral_program_service import (
        get_referral_program_settings,
        serialize_program_settings,
    )
    from app.application.referral.referral_reward_service import list_referral_reward_rules

    payload = get_admin_referral_scheme()
    program_settings = await get_referral_program_settings(db)
    payload.update(serialize_program_settings(program_settings))
    payload["qualification_hold_days"] = program_settings.default_qualification_hold_days
    payload["default_qualification_hold_days"] = program_settings.default_qualification_hold_days
    rules = await list_referral_reward_rules(db, include_inactive=True)
    payload["rules"] = [
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
        for rule in rules
    ]
    return payload


def _attribution_filters(
    *,
    stage: ReferralStage | None,
    search: str | None,
):
    clauses = []
    if stage is not None:
        clauses.append(ReferralAttribution.current_stage == stage)
    if search:
        term = f"%{search.strip()}%"
        clauses.append(
            or_(
                ReferralAttribution.referral_code.ilike(term),
                ReferrerUser.email.ilike(term),
                ReferrerUser.client_id.ilike(term),
                RefereeUser.email.ilike(term),
                RefereeUser.client_id.ilike(term),
                ReferrerUser.first_name.ilike(term),
                ReferrerUser.last_name.ilike(term),
                RefereeUser.first_name.ilike(term),
                RefereeUser.last_name.ilike(term),
            )
        )
    return clauses


async def _serialize_attribution_row(
    db: AsyncSession,
    attribution: ReferralAttribution,
    referrer: User,
    referee: User,
) -> dict[str, Any]:
    from app.application.referral.referral_program_service import (
        get_referral_program_settings,
        qualification_due_at_for_attribution,
    )
    from app.application.referral.referral_reward_service import estimate_reward_inr_for_attribution

    program_settings = await get_referral_program_settings(db)
    pending_qualification = False
    qualification_due_at: datetime | None = None
    if (
        attribution.current_stage == ReferralStage.first_investment
        and attribution.first_investment_at is not None
        and attribution.first_investment_reversed_at is None
    ):
        qualification_due_at = qualification_due_at_for_attribution(attribution, program_settings)
        pending_qualification = qualification_due_at is not None and utcnow() < qualification_due_at

    return {
        "id": str(attribution.id),
        "referral_code": attribution.referral_code,
        "current_stage": attribution.current_stage.value,
        "signup_channel": attribution.signup_channel.value,
        "signed_up_at": attribution.signed_up_at,
        "kyc_verified_at": attribution.kyc_verified_at,
        "first_investment_at": attribution.first_investment_at,
        "first_investment_product": (
            attribution.first_investment_product.value
            if attribution.first_investment_product is not None
            else None
        ),
        "first_investment_mode": (
            attribution.first_investment_mode.value
            if attribution.first_investment_mode is not None
            else None
        ),
        "first_investment_amount_inr": attribution.first_investment_amount_inr,
        "first_investment_reversed_at": attribution.first_investment_reversed_at,
        "qualified_at": attribution.qualified_at,
        "engaged_at": attribution.engaged_at,
        "estimated_reward_inr": await estimate_reward_inr_for_attribution(db, attribution),
        "pending_qualification": pending_qualification,
        "qualification_due_at": qualification_due_at,
        "referrer": _user_summary(referrer),
        "referee": _user_summary(referee),
    }


async def list_admin_referral_attributions(
    db: AsyncSession,
    *,
    stage: ReferralStage | None = None,
    search: str | None = None,
    pending_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    stmt = (
        select(ReferralAttribution, ReferrerUser, RefereeUser)
        .join(ReferrerUser, ReferrerUser.id == ReferralAttribution.referrer_user_id)
        .join(RefereeUser, RefereeUser.id == ReferralAttribution.referee_user_id)
        .order_by(ReferralAttribution.signed_up_at.desc())
        .limit(limit)
        .offset(offset)
    )

    filters = _attribution_filters(stage=stage, search=search)
    if pending_only:
        filters.append(ReferralAttribution.current_stage == ReferralStage.first_investment)
        filters.append(ReferralAttribution.first_investment_reversed_at.is_(None))
        filters.append(ReferralAttribution.first_investment_at.is_not(None))

    if filters:
        stmt = stmt.where(*filters)

    rows = (await db.execute(stmt)).all()
    items: list[dict[str, Any]] = []
    for attribution, referrer, referee in rows:
        items.append(await _serialize_attribution_row(db, attribution, referrer, referee))
    return items


async def list_admin_referral_leaderboard(
    db: AsyncSession,
    *,
    period: str = "all_time",
    limit: int = 25,
) -> list[dict[str, Any]]:
    period_range = await resolve_leaderboard_period_range(db, period)
    rows: list[dict[str, Any]]

    if (
        period_range.key != "all_time"
        and period_range.key != "last_3_months"
        and not period_range.is_current_month
    ):
        snapshots = await list_leaderboard_from_snapshots(db, period_key=period_range.key, limit=limit)
        if snapshots:
            user_ids = [row.referrer_user_id for row in snapshots]
            users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
            users_by_id = {user.id: user for user in users_result.scalars()}
            rows = []
            for snapshot in snapshots:
                user = users_by_id.get(snapshot.referrer_user_id)
                rows.append(
                    {
                        "rank": snapshot.rank,
                        "referrer_user_id": snapshot.referrer_user_id,
                        "referral_count": snapshot.referral_count,
                        "earnings_inr": snapshot.earnings_inr,
                        "user": user,
                        "display_name": display_name_for_user(user) if user else "Referrer",
                    }
                )
        else:
            rows = await compute_leaderboard_rows(db, period_range=period_range, limit=limit)
    else:
        rows = await compute_leaderboard_rows(db, period_range=period_range, limit=limit)

    if not rows:
        return []

    items: list[dict[str, Any]] = []
    for row in rows:
        user = row.get("user")
        referrer_user_id = row.get("referrer_user_id") or (user.id if user else None)
        code_row = await get_referral_code_for_user(db, user_id=referrer_user_id) if referrer_user_id else None
        items.append(
            {
                "rank": row["rank"],
                "referral_count": int(row["referral_count"] or 0),
                "estimated_earnings_inr": int(row.get("earnings_inr") or 0),
                "referral_code": code_row.code if code_row else None,
                "user": _user_summary(user),
                "display_name": row.get("display_name") or (display_name_for_user(user) if user else "Referrer"),
            }
        )
    return items


async def get_admin_user_referrals(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    settings = get_settings()
    user = await db.get(User, user_id)
    if user is None:
        return {}

    code_row = await get_referral_code_for_user(db, user_id=user_id)
    click_count = 0
    if code_row is not None:
        click_count = int(
            (
                await db.execute(
                    select(func.count())
                    .select_from(ReferralClick)
                    .where(ReferralClick.referral_code_id == code_row.id)
                )
            ).scalar_one()
        )

    base = settings.frontend_url.rstrip("/")
    share_url = f"{base}/r/{code_row.code}" if code_row else None

    as_referrer_counts = {
        "signup_count": await count_signups_for_referrer(db, referrer_user_id=user_id),
        "kyc_verified_count": await count_kyc_verified_for_referrer(db, referrer_user_id=user_id),
        "first_investment_count": await count_first_investment_for_referrer(
            db, referrer_user_id=user_id
        ),
        "qualified_count": await count_qualified_for_referrer(db, referrer_user_id=user_id),
        "engaged_count": await count_engaged_for_referrer(db, referrer_user_id=user_id),
    }

    referral_rows = await list_referrals_for_referrer(db, referrer_user_id=user_id, limit=100)
    referrals: list[dict[str, Any]] = []
    for attribution, referee in referral_rows:
        referrals.append(await _serialize_attribution_row(db, attribution, user, referee))
    total_estimated_earnings_inr = sum(item["estimated_reward_inr"] for item in referrals)

    as_referee_attribution = await get_attribution_for_referee(db, referee_user_id=user_id)
    referred_by: dict[str, Any] | None = None
    if as_referee_attribution is not None:
        referrer = await db.get(User, as_referee_attribution.referrer_user_id)
        if referrer is not None:
            referred_by = await _serialize_attribution_row(
                db, as_referee_attribution, referrer, user
            )

    return {
        "user": _user_summary(user),
        "referral_code": code_row.code if code_row else None,
        "referral_code_active": code_row.is_active if code_row else False,
        "share_url": share_url,
        "click_count": click_count,
        "counts": as_referrer_counts,
        "total_estimated_earnings_inr": total_estimated_earnings_inr,
        "referrals": referrals,
        "referred_by": referred_by,
    }
