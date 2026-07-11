from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from math import ceil
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    REFERRAL_STAGE_ORDER,
    ReferralAttribution,
    ReferralStage,
)


class ReferralLeaderboardPeriod(str, Enum):
    this_month = "this_month"
    last_3_months = "last_3_months"
    all_time = "all_time"


REFERRAL_REWARD_RATE = 0.02


@dataclass(frozen=True, slots=True)
class ReferralLeaderboardRow:
    rank: int
    user_id: UUID
    name: str
    referral_count: int
    earnings_inr: int
    is_current_user: bool
    profile_image_url: str | None = None


@dataclass(frozen=True, slots=True)
class ReferralLeaderboardCurrentUser:
    rank: int | None
    referral_count: int
    earnings_inr: int
    top_percent: int | None


def display_name_for_user(user: User) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first and last:
        return f"{first} {last[0]}."
    if first:
        return first
    if last:
        return last
    local = user.email.split("@", maxsplit=1)[0]
    if not local:
        return "Referrer"
    return local[:1].upper() + local[1:2].lower() + "."


def referee_display_name_for_user(user: User) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first and last:
        return f"{first} {last}"
    if first:
        return first
    if last:
        return last
    local = user.email.split("@", maxsplit=1)[0]
    if not local:
        return "Referral"
    return local[:1].upper() + local[1:]


def _period_start(period: ReferralLeaderboardPeriod, now: datetime) -> datetime | None:
    if period == ReferralLeaderboardPeriod.all_time:
        return None
    if period == ReferralLeaderboardPeriod.this_month:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now - timedelta(days=90)


def _earnings_expr():
    invested_stages = REFERRAL_STAGE_ORDER[
        REFERRAL_STAGE_ORDER.index(ReferralStage.first_investment) :
    ]
    return func.coalesce(
        func.sum(
            case(
                (
                    ReferralAttribution.current_stage.in_(invested_stages),
                    ReferralAttribution.first_investment_amount_inr * REFERRAL_REWARD_RATE,
                ),
                else_=0,
            )
        ),
        0,
    )


async def get_referral_leaderboard(
    db: AsyncSession,
    *,
    current_user_id: UUID,
    period: ReferralLeaderboardPeriod = ReferralLeaderboardPeriod.this_month,
    limit: int = 50,
    now: datetime | None = None,
) -> tuple[list[ReferralLeaderboardRow], ReferralLeaderboardCurrentUser]:
    now = now or utcnow()
    period_start = _period_start(period, now)

    referral_count_expr = func.count(ReferralAttribution.id)
    earnings_expr = _earnings_expr()

    stmt = (
        select(
            ReferralAttribution.referrer_user_id,
            referral_count_expr.label("referral_count"),
            earnings_expr.label("earnings_inr"),
        )
        .group_by(ReferralAttribution.referrer_user_id)
        .order_by(referral_count_expr.desc(), earnings_expr.desc())
        .limit(limit)
    )
    if period_start is not None:
        stmt = stmt.where(ReferralAttribution.signed_up_at >= period_start)

    aggregate_rows = list((await db.execute(stmt)).all())
    if not aggregate_rows:
        return [], ReferralLeaderboardCurrentUser(
            rank=None,
            referral_count=0,
            earnings_inr=0,
            top_percent=None,
        )

    user_ids = [row.referrer_user_id for row in aggregate_rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {user.id: user for user in users_result.scalars()}
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, user_ids)

    entries: list[ReferralLeaderboardRow] = []
    current_user_stats = ReferralLeaderboardCurrentUser(
        rank=None,
        referral_count=0,
        earnings_inr=0,
        top_percent=None,
    )

    for index, row in enumerate(aggregate_rows, start=1):
        user = users_by_id.get(row.referrer_user_id)
        name = display_name_for_user(user) if user is not None else "Referrer"
        earnings_inr = int(row.earnings_inr or 0)
        is_current_user = row.referrer_user_id == current_user_id
        entry = ReferralLeaderboardRow(
            rank=index,
            user_id=row.referrer_user_id,
            name=name,
            referral_count=int(row.referral_count or 0),
            earnings_inr=earnings_inr,
            is_current_user=is_current_user,
            profile_image_url=profile_image_urls.get(row.referrer_user_id),
        )
        entries.append(entry)
        if is_current_user:
            current_user_stats = ReferralLeaderboardCurrentUser(
                rank=index,
                referral_count=entry.referral_count,
                earnings_inr=entry.earnings_inr,
                top_percent=_top_percent(index, len(aggregate_rows)),
            )

    if current_user_stats.rank is None:
        solo_stmt = (
            select(
                referral_count_expr.label("referral_count"),
                earnings_expr.label("earnings_inr"),
            )
            .where(ReferralAttribution.referrer_user_id == current_user_id)
        )
        if period_start is not None:
            solo_stmt = solo_stmt.where(ReferralAttribution.signed_up_at >= period_start)

        solo_row = (await db.execute(solo_stmt)).one_or_none()
        if solo_row is not None and int(solo_row.referral_count or 0) > 0:
            current_user_stats = ReferralLeaderboardCurrentUser(
                rank=None,
                referral_count=int(solo_row.referral_count or 0),
                earnings_inr=int(solo_row.earnings_inr or 0),
                top_percent=None,
            )

    return entries, current_user_stats


def _top_percent(rank: int, total: int) -> int | None:
    if total <= 0:
        return None
    return max(1, min(100, int(ceil((rank / total) * 100))))
