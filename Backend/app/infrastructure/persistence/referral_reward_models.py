"""Referral reward rules and payout ledger."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReferralRewardTrigger(str, enum.Enum):
    first_investment = "first_investment"
    kyc_verified = "kyc_verified"
    qualified = "qualified"
    engaged = "engaged"


class ReferralRewardType(str, enum.Enum):
    flat_inr = "flat_inr"
    percent = "percent"


class ReferralRewardLedgerStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    paid = "paid"
    reversed = "reversed"
    cancelled = "cancelled"


class ReferralRewardRule(Base):
    __tablename__ = "referral_reward_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger: Mapped[ReferralRewardTrigger] = mapped_column(
        Enum(ReferralRewardTrigger, name="referralrewardtrigger"),
        nullable=False,
        index=True,
    )
    reward_type: Mapped[ReferralRewardType] = mapped_column(
        Enum(ReferralRewardType, name="referralrewardtype"),
        nullable=False,
    )
    reward_value: Mapped[int] = mapped_column(Integer, nullable=False)
    min_investment_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReferralRewardLedger(Base):
    __tablename__ = "referral_reward_ledger"
    __table_args__ = (
        UniqueConstraint(
            "attribution_id",
            "rule_id",
            name="uq_referral_reward_ledger_attribution_rule",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("referral_attributions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    referrer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    referee_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("referral_reward_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rule_name: Mapped[str] = mapped_column(String(120), nullable=False)
    trigger: Mapped[ReferralRewardTrigger] = mapped_column(
        Enum(ReferralRewardTrigger, name="referralrewardtrigger", create_type=False),
        nullable=False,
    )
    amount_inr: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ReferralRewardLedgerStatus] = mapped_column(
        Enum(ReferralRewardLedgerStatus, name="referralrewardledgerstatus"),
        default=ReferralRewardLedgerStatus.pending,
        nullable=False,
        index=True,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
