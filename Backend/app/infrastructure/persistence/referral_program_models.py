"""Referral program settings, leaderboard config, and monthly snapshots."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReferralLeaderboardPrimaryMetric(str, enum.Enum):
    signup_count = "signup_count"
    kyc_verified_count = "kyc_verified_count"
    first_investment_count = "first_investment_count"
    qualified_count = "qualified_count"


class ReferralLeaderboardTieBreaker(str, enum.Enum):
    earnings_inr_desc = "earnings_inr_desc"
    referral_count_desc = "referral_count_desc"
    earliest_referral_asc = "earliest_referral_asc"


class ReferralLeaderboardPeriodField(str, enum.Enum):
    signed_up_at = "signed_up_at"
    first_investment_at = "first_investment_at"
    qualified_at = "qualified_at"


class ReferralProgramSettings(Base):
    __tablename__ = "referral_program_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    min_referrals_to_redeem: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    lumpsum_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    default_qualification_hold_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    min_first_investment_inr: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReferralLeaderboardConfig(Base):
    __tablename__ = "referral_leaderboard_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    primary_metric: Mapped[ReferralLeaderboardPrimaryMetric] = mapped_column(
        "primary_metric",
        String(32),
        nullable=False,
        default=ReferralLeaderboardPrimaryMetric.signup_count.value,
    )
    tie_breaker_1: Mapped[ReferralLeaderboardTieBreaker] = mapped_column(
        "tie_breaker_1",
        String(32),
        nullable=False,
        default=ReferralLeaderboardTieBreaker.earnings_inr_desc.value,
    )
    tie_breaker_2: Mapped[ReferralLeaderboardTieBreaker] = mapped_column(
        "tie_breaker_2",
        String(32),
        nullable=False,
        default=ReferralLeaderboardTieBreaker.earliest_referral_asc.value,
    )
    period_field: Mapped[ReferralLeaderboardPeriodField] = mapped_column(
        "period_field",
        String(32),
        nullable=False,
        default=ReferralLeaderboardPeriodField.signed_up_at.value,
    )
    auto_snapshot_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReferralLeaderboardSnapshot(Base):
    __tablename__ = "referral_leaderboard_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "period_key",
            "referrer_user_id",
            name="uq_referral_leaderboard_snapshot_period_referrer",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_key: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    referrer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    referral_count: Mapped[int] = mapped_column(Integer, nullable=False)
    earnings_inr: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    earliest_referral_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
