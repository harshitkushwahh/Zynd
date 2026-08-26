"""Referral program settings and leaderboard configuration."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.persistence.referral_models import ReferralAttribution, ReferralInvestmentMode
from app.infrastructure.persistence.referral_program_models import (
    ReferralLeaderboardConfig,
    ReferralLeaderboardPeriodField,
    ReferralLeaderboardPrimaryMetric,
    ReferralLeaderboardTieBreaker,
    ReferralProgramSettings,
)

MONTH_PERIOD_PATTERN = re.compile(r"^\d{4}-\d{2}$")


def is_month_period_key(value: str) -> bool:
    return bool(MONTH_PERIOD_PATTERN.match(value))


def month_period_bounds(
    period_key: str,
    *,
    timezone_name: str = "Asia/Kolkata",
) -> tuple[datetime, datetime]:
    tz = ZoneInfo(timezone_name)
    year, month = map(int, period_key.split("-"))
    start = datetime(year, month, 1, tzinfo=tz)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=tz)
    else:
        end = datetime(year, month + 1, 1, tzinfo=tz)
    return start, end


def list_recent_month_period_keys(
    *,
    count: int = 12,
    now: datetime | None = None,
    timezone_name: str = "Asia/Kolkata",
) -> list[str]:
    tz = ZoneInfo(timezone_name)
    now = now.astimezone(tz) if now is not None else datetime.now(tz)
    year = now.year
    month = now.month
    keys: list[str] = []
    for _ in range(count):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return keys


async def get_referral_program_settings(db: AsyncSession) -> ReferralProgramSettings:
    row = await db.get(ReferralProgramSettings, 1)
    if row is not None:
        return row

    settings = get_settings()
    row = ReferralProgramSettings(
        id=1,
        min_referrals_to_redeem=15,
        lumpsum_retention_days=180,
        default_qualification_hold_days=settings.referral_qualification_hold_days,
        min_first_investment_inr=settings.referral_min_first_investment_inr,
    )
    db.add(row)
    await db.flush()
    return row


async def update_referral_program_settings(
    db: AsyncSession,
    *,
    payload: dict[str, Any],
) -> ReferralProgramSettings:
    row = await get_referral_program_settings(db)
    for key, value in payload.items():
        if value is not None:
            setattr(row, key, value)
    await db.flush()
    return row


async def get_referral_leaderboard_config(db: AsyncSession) -> ReferralLeaderboardConfig:
    row = await db.get(ReferralLeaderboardConfig, 1)
    if row is not None:
        return row

    row = ReferralLeaderboardConfig(id=1)
    db.add(row)
    await db.flush()
    return row


async def update_referral_leaderboard_config(
    db: AsyncSession,
    *,
    payload: dict[str, Any],
) -> ReferralLeaderboardConfig:
    row = await get_referral_leaderboard_config(db)
    for key, value in payload.items():
        if value is not None:
            setattr(row, key, value)
    await db.flush()
    return row


def serialize_program_settings(row: ReferralProgramSettings) -> dict[str, Any]:
    return {
        "min_referrals_to_redeem": row.min_referrals_to_redeem,
        "lumpsum_retention_days": row.lumpsum_retention_days,
        "default_qualification_hold_days": row.default_qualification_hold_days,
        "min_first_investment_inr": row.min_first_investment_inr,
        "timezone": row.timezone,
        "updated_at": row.updated_at,
    }


def serialize_leaderboard_config(row: ReferralLeaderboardConfig) -> dict[str, Any]:
    return {
        "primary_metric": row.primary_metric,
        "tie_breaker_1": row.tie_breaker_1,
        "tie_breaker_2": row.tie_breaker_2,
        "period_field": row.period_field,
        "auto_snapshot_enabled": row.auto_snapshot_enabled,
        "updated_at": row.updated_at,
    }


def qualification_hold_days_for_attribution(
    attribution: ReferralAttribution,
    program_settings: ReferralProgramSettings,
) -> int:
    if attribution.first_investment_mode == ReferralInvestmentMode.lumpsum:
        return program_settings.lumpsum_retention_days
    return program_settings.default_qualification_hold_days


def qualification_due_at_for_attribution(
    attribution: ReferralAttribution,
    program_settings: ReferralProgramSettings,
) -> datetime | None:
    if attribution.first_investment_at is None:
        return None
    return attribution.first_investment_at + timedelta(
        days=qualification_hold_days_for_attribution(attribution, program_settings)
    )


def metric_stage_for_config(config: ReferralLeaderboardConfig):
    from app.infrastructure.persistence.referral_models import ReferralStage

    mapping = {
        ReferralLeaderboardPrimaryMetric.signup_count.value: ReferralStage.signed_up,
        ReferralLeaderboardPrimaryMetric.kyc_verified_count.value: ReferralStage.kyc_verified,
        ReferralLeaderboardPrimaryMetric.first_investment_count.value: ReferralStage.first_investment,
        ReferralLeaderboardPrimaryMetric.qualified_count.value: ReferralStage.qualified,
    }
    return mapping.get(config.primary_metric, ReferralStage.signed_up)


def period_column_for_config(config: ReferralLeaderboardConfig):
    mapping = {
        ReferralLeaderboardPeriodField.signed_up_at.value: ReferralAttribution.signed_up_at,
        ReferralLeaderboardPeriodField.first_investment_at.value: ReferralAttribution.first_investment_at,
        ReferralLeaderboardPeriodField.qualified_at.value: ReferralAttribution.qualified_at,
    }
    return mapping.get(config.period_field, ReferralAttribution.signed_up_at)


def tie_breaker_order_columns(
    config: ReferralLeaderboardConfig,
    *,
    referral_count_expr,
    earnings_expr,
    earliest_expr,
):
    columns = []
    for tie_breaker in (config.tie_breaker_1, config.tie_breaker_2):
        if tie_breaker == ReferralLeaderboardTieBreaker.earnings_inr_desc.value:
            columns.append(earnings_expr.desc())
        elif tie_breaker == ReferralLeaderboardTieBreaker.referral_count_desc.value:
            columns.append(referral_count_expr.desc())
        elif tie_breaker == ReferralLeaderboardTieBreaker.earliest_referral_asc.value:
            columns.append(earliest_expr.asc())
    return columns
