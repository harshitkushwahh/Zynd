from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from math import ceil
from uuid import UUID

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.referral.referral_program_service import (
    is_month_period_key,
    list_recent_month_period_keys,
    metric_stage_for_config,
    month_period_bounds,
    period_column_for_config,
    tie_breaker_order_columns,
)
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    REFERRAL_STAGE_ORDER,
    ReferralAttribution,
    ReferralStage,
)
from app.infrastructure.persistence.referral_program_models import ReferralLeaderboardSnapshot
from app.infrastructure.persistence.referral_reward_models import ReferralRewardLedger


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


@dataclass(frozen=True, slots=True)
class LeaderboardPeriodRange:
    key: str
    start: datetime | None
    end: datetime | None
    is_current_month: bool = False
    from_snapshot: bool = False


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


def _stages_at_or_beyond(minimum: ReferralStage) -> tuple[ReferralStage, ...]:
    index = REFERRAL_STAGE_ORDER.index(minimum)
    return REFERRAL_STAGE_ORDER[index:]


def _period_start(period: ReferralLeaderboardPeriod, now: datetime) -> datetime | None:
    if period == ReferralLeaderboardPeriod.all_time:
        return None
    if period == ReferralLeaderboardPeriod.this_month:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now - timedelta(days=90)


async def resolve_leaderboard_period_range(
    db: AsyncSession,
    period: str,
    *,
    now: datetime | None = None,
) -> LeaderboardPeriodRange:
    from app.application.referral.referral_program_service import get_referral_program_settings

    now = now or utcnow()
    program_settings = await get_referral_program_settings(db)

    if is_month_period_key(period):
        start, end = month_period_bounds(period, timezone_name=program_settings.timezone)
        current_key = list_recent_month_period_keys(
            count=1,
            now=now,
            timezone_name=program_settings.timezone,
        )[0]
        return LeaderboardPeriodRange(
            key=period,
            start=start,
            end=end,
            is_current_month=period == current_key,
        )

    try:
        enum_period = ReferralLeaderboardPeriod(period)
    except ValueError as exc:
        raise ValueError(f"Invalid leaderboard period: {period}") from exc

    if enum_period == ReferralLeaderboardPeriod.all_time:
        return LeaderboardPeriodRange(key=enum_period.value, start=None, end=None)
    if enum_period == ReferralLeaderboardPeriod.this_month:
        start, end = month_period_bounds(
            list_recent_month_period_keys(count=1, now=now, timezone_name=program_settings.timezone)[0],
            timezone_name=program_settings.timezone,
        )
        return LeaderboardPeriodRange(
            key=enum_period.value,
            start=start,
            end=end,
            is_current_month=True,
        )
    return LeaderboardPeriodRange(
        key=enum_period.value,
        start=now - timedelta(days=90),
        end=None,
    )


def _earnings_expr():
    invested_stages = _stages_at_or_beyond(ReferralStage.first_investment)
    ledger_sum = (
        select(func.coalesce(func.sum(ReferralRewardLedger.amount_inr), 0))
        .where(ReferralRewardLedger.attribution_id == ReferralAttribution.id)
        .correlate(ReferralAttribution)
        .scalar_subquery()
    )
    return func.coalesce(
        func.sum(
            case(
                (
                    ReferralAttribution.current_stage.in_(invested_stages),
                    func.coalesce(
                        ledger_sum,
                        ReferralAttribution.first_investment_amount_inr * REFERRAL_REWARD_RATE,
                    ),
                ),
                else_=0,
            )
        ),
        0,
    )


async def _leaderboard_aggregate_stmt(
    db: AsyncSession,
    *,
    period_range: LeaderboardPeriodRange,
    limit: int | None = None,
):
    from app.application.referral.referral_program_service import get_referral_leaderboard_config

    config = await get_referral_leaderboard_config(db)
    minimum_stage = metric_stage_for_config(config)
    period_column = period_column_for_config(config)
    qualifying_stages = _stages_at_or_beyond(minimum_stage)

    referral_count_expr = func.count(
        case((ReferralAttribution.current_stage.in_(qualifying_stages), ReferralAttribution.id), else_=None)
    )
    earnings_expr = _earnings_expr()
    earliest_expr = func.min(period_column)

    stmt = (
        select(
            ReferralAttribution.referrer_user_id,
            referral_count_expr.label("referral_count"),
            earnings_expr.label("earnings_inr"),
            earliest_expr.label("earliest_referral_at"),
        )
        .where(ReferralAttribution.current_stage.in_(qualifying_stages))
        .group_by(ReferralAttribution.referrer_user_id)
        .order_by(
            referral_count_expr.desc(),
            *tie_breaker_order_columns(
                config,
                referral_count_expr=referral_count_expr,
                earnings_expr=earnings_expr,
                earliest_expr=earliest_expr,
            ),
        )
    )
    if period_range.start is not None:
        stmt = stmt.where(period_column >= period_range.start)
    if period_range.end is not None:
        stmt = stmt.where(period_column < period_range.end)
    if limit is not None:
        stmt = stmt.limit(limit)
    return stmt


async def compute_leaderboard_rows(
    db: AsyncSession,
    *,
    period_range: LeaderboardPeriodRange,
    limit: int = 50,
) -> list[dict]:
    aggregate_rows = list((await db.execute(await _leaderboard_aggregate_stmt(db, period_range=period_range, limit=limit))).all())
    if not aggregate_rows:
        return []

    user_ids = [row.referrer_user_id for row in aggregate_rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {user.id: user for user in users_result.scalars()}

    items: list[dict] = []
    for index, row in enumerate(aggregate_rows, start=1):
        user = users_by_id.get(row.referrer_user_id)
        items.append(
            {
                "rank": index,
                "referrer_user_id": row.referrer_user_id,
                "referral_count": int(row.referral_count or 0),
                "earnings_inr": int(row.earnings_inr or 0),
                "earliest_referral_at": row.earliest_referral_at,
                "display_name": display_name_for_user(user) if user else "Referrer",
                "user": user,
            }
        )
    return items


async def list_leaderboard_from_snapshots(
    db: AsyncSession,
    *,
    period_key: str,
    limit: int = 50,
) -> list[ReferralLeaderboardSnapshot]:
    result = await db.execute(
        select(ReferralLeaderboardSnapshot)
        .where(ReferralLeaderboardSnapshot.period_key == period_key)
        .order_by(ReferralLeaderboardSnapshot.rank.asc())
        .limit(limit)
    )
    return list(result.scalars())


async def snapshot_exists(db: AsyncSession, *, period_key: str) -> bool:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralLeaderboardSnapshot)
        .where(ReferralLeaderboardSnapshot.period_key == period_key)
    )
    return int(result.scalar_one()) > 0


async def compute_and_store_leaderboard_snapshot(
    db: AsyncSession,
    *,
    period_key: str,
    finalize: bool = False,
    limit: int = 200,
) -> dict[str, int]:
    period_range = await resolve_leaderboard_period_range(db, period_key)
    rows = await compute_leaderboard_rows(db, period_range=period_range, limit=limit)

    await db.execute(
        delete(ReferralLeaderboardSnapshot).where(
            ReferralLeaderboardSnapshot.period_key == period_key
        )
    )

    for row in rows:
        db.add(
            ReferralLeaderboardSnapshot(
                period_key=period_key,
                referrer_user_id=row["referrer_user_id"],
                rank=row["rank"],
                referral_count=row["referral_count"],
                earnings_inr=row["earnings_inr"],
                earliest_referral_at=row["earliest_referral_at"],
                is_final=finalize,
            )
        )
    await db.flush()
    return {"period_key": period_key, "rows": len(rows), "finalized": int(finalize)}


async def get_referral_leaderboard(
    db: AsyncSession,
    *,
    current_user_id: UUID,
    period: ReferralLeaderboardPeriod = ReferralLeaderboardPeriod.this_month,
    limit: int = 50,
    now: datetime | None = None,
) -> tuple[list[ReferralLeaderboardRow], ReferralLeaderboardCurrentUser]:
    period_range = await resolve_leaderboard_period_range(db, period.value, now=now)
    return await _build_leaderboard_response(
        db,
        current_user_id=current_user_id,
        period_range=period_range,
        limit=limit,
    )


async def get_referral_leaderboard_for_period_key(
    db: AsyncSession,
    *,
    current_user_id: UUID | None,
    period_key: str,
    limit: int = 50,
    now: datetime | None = None,
) -> tuple[list[ReferralLeaderboardRow], ReferralLeaderboardCurrentUser | None]:
    period_range = await resolve_leaderboard_period_range(db, period_key, now=now)

    if is_month_period_key(period_key) and not period_range.is_current_month:
        snapshots = await list_leaderboard_from_snapshots(db, period_key=period_key, limit=limit)
        if snapshots:
            period_range = LeaderboardPeriodRange(
                key=period_key,
                start=period_range.start,
                end=period_range.end,
                from_snapshot=True,
            )
            return await _build_leaderboard_response_from_snapshots(
                db,
                current_user_id=current_user_id,
                snapshots=snapshots,
            )

    return await _build_leaderboard_response(
        db,
        current_user_id=current_user_id,
        period_range=period_range,
        limit=limit,
    )


async def _build_leaderboard_response_from_snapshots(
    db: AsyncSession,
    *,
    current_user_id: UUID | None,
    snapshots: list[ReferralLeaderboardSnapshot],
) -> tuple[list[ReferralLeaderboardRow], ReferralLeaderboardCurrentUser | None]:
    if not snapshots:
        empty = ReferralLeaderboardCurrentUser(rank=None, referral_count=0, earnings_inr=0, top_percent=None)
        return [], empty if current_user_id else None

    user_ids = [row.referrer_user_id for row in snapshots]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {user.id: user for user in users_result.scalars()}
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, user_ids)

    entries: list[ReferralLeaderboardRow] = []
    current_user_stats: ReferralLeaderboardCurrentUser | None = None

    for snapshot in snapshots:
        user = users_by_id.get(snapshot.referrer_user_id)
        is_current_user = current_user_id is not None and snapshot.referrer_user_id == current_user_id
        entry = ReferralLeaderboardRow(
            rank=snapshot.rank,
            user_id=snapshot.referrer_user_id,
            name=display_name_for_user(user) if user else "Referrer",
            referral_count=snapshot.referral_count,
            earnings_inr=snapshot.earnings_inr,
            is_current_user=is_current_user,
            profile_image_url=profile_image_urls.get(snapshot.referrer_user_id),
        )
        entries.append(entry)
        if is_current_user:
            current_user_stats = ReferralLeaderboardCurrentUser(
                rank=snapshot.rank,
                referral_count=entry.referral_count,
                earnings_inr=entry.earnings_inr,
                top_percent=_top_percent(snapshot.rank, len(snapshots)),
            )

    if current_user_id and current_user_stats is None:
        current_user_stats = ReferralLeaderboardCurrentUser(
            rank=None,
            referral_count=0,
            earnings_inr=0,
            top_percent=None,
        )
    return entries, current_user_stats


async def _build_leaderboard_response(
    db: AsyncSession,
    *,
    current_user_id: UUID | None,
    period_range: LeaderboardPeriodRange,
    limit: int,
) -> tuple[list[ReferralLeaderboardRow], ReferralLeaderboardCurrentUser | None]:
    aggregate_rows = list(
        (
            await db.execute(
                await _leaderboard_aggregate_stmt(db, period_range=period_range, limit=limit)
            )
        ).all()
    )
    if not aggregate_rows:
        empty = ReferralLeaderboardCurrentUser(rank=None, referral_count=0, earnings_inr=0, top_percent=None)
        return [], empty if current_user_id else None

    user_ids = [row.referrer_user_id for row in aggregate_rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {user.id: user for user in users_result.scalars()}
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, user_ids)

    entries: list[ReferralLeaderboardRow] = []
    current_user_stats: ReferralLeaderboardCurrentUser | None = None

    for index, row in enumerate(aggregate_rows, start=1):
        user = users_by_id.get(row.referrer_user_id)
        earnings_inr = int(row.earnings_inr or 0)
        is_current_user = current_user_id is not None and row.referrer_user_id == current_user_id
        entry = ReferralLeaderboardRow(
            rank=index,
            user_id=row.referrer_user_id,
            name=display_name_for_user(user) if user else "Referrer",
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

    if current_user_id and current_user_stats is None:
        from app.application.referral.referral_program_service import (
            get_referral_leaderboard_config,
            metric_stage_for_config,
            period_column_for_config,
        )

        config = await get_referral_leaderboard_config(db)
        minimum_stage = metric_stage_for_config(config)
        period_column = period_column_for_config(config)
        qualifying_stages = _stages_at_or_beyond(minimum_stage)
        referral_count_expr = func.count(
            case((ReferralAttribution.current_stage.in_(qualifying_stages), ReferralAttribution.id), else_=None)
        )
        earnings_expr = _earnings_expr()
        solo_stmt = select(
            referral_count_expr.label("referral_count"),
            earnings_expr.label("earnings_inr"),
        ).where(
            ReferralAttribution.referrer_user_id == current_user_id,
            ReferralAttribution.current_stage.in_(qualifying_stages),
        )
        if period_range.start is not None:
            solo_stmt = solo_stmt.where(period_column >= period_range.start)
        if period_range.end is not None:
            solo_stmt = solo_stmt.where(period_column < period_range.end)

        solo_row = (await db.execute(solo_stmt)).one_or_none()
        if solo_row is not None and int(solo_row.referral_count or 0) > 0:
            current_user_stats = ReferralLeaderboardCurrentUser(
                rank=None,
                referral_count=int(solo_row.referral_count or 0),
                earnings_inr=int(solo_row.earnings_inr or 0),
                top_percent=None,
            )
        else:
            current_user_stats = ReferralLeaderboardCurrentUser(
                rank=None,
                referral_count=0,
                earnings_inr=0,
                top_percent=None,
            )

    return entries, current_user_stats


def _top_percent(rank: int, total: int) -> int | None:
    if total <= 0:
        return None
    return max(1, min(100, int(ceil((rank / total) * 100))))
