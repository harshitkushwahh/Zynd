"""Referral program persistence — Stage 0+ (codes, clicks, attributions)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReferralSignupChannel(str, enum.Enum):
    email = "email"
    google = "google"
    apple = "apple"


class ReferralStage(str, enum.Enum):
    signed_up = "signed_up"
    kyc_verified = "kyc_verified"
    first_investment = "first_investment"
    qualified = "qualified"
    engaged = "engaged"


class ReferralInvestmentProduct(str, enum.Enum):
    mutual_fund = "mutual_fund"
    fixed_deposit = "fixed_deposit"
    other = "other"


class ReferralInvestmentMode(str, enum.Enum):
    lumpsum = "lumpsum"
    sip = "sip"
    other = "other"


class ReferralEngagementMilestone(str, enum.Enum):
    second_investment = "second_investment"
    additional_product = "additional_product"
    aum_milestone = "aum_milestone"


REFERRAL_STAGE_ORDER: tuple[ReferralStage, ...] = (
    ReferralStage.signed_up,
    ReferralStage.kyc_verified,
    ReferralStage.first_investment,
    ReferralStage.qualified,
    ReferralStage.engaged,
)


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    clicks: Mapped[list["ReferralClick"]] = relationship(back_populates="referral_code")


class ReferralClick(Base):
    __tablename__ = "referral_clicks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("referral_codes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    referrer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent_snippet: Mapped[str | None] = mapped_column(String(255), nullable=True)
    clicked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    referral_code: Mapped[ReferralCode] = relationship(back_populates="clicks")


class ReferralAttribution(Base):
    __tablename__ = "referral_attributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
        unique=True,
        index=True,
    )
    referral_code: Mapped[str] = mapped_column(String(16), nullable=False)
    signup_channel: Mapped[ReferralSignupChannel] = mapped_column(
        Enum(ReferralSignupChannel, name="referralsignupchannel"),
        nullable=False,
    )
    current_stage: Mapped[ReferralStage] = mapped_column(
        Enum(ReferralStage, name="referralstage"),
        default=ReferralStage.signed_up,
        nullable=False,
    )
    signed_up_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    kyc_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    first_investment_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    first_investment_product: Mapped[ReferralInvestmentProduct | None] = mapped_column(
        Enum(ReferralInvestmentProduct, name="referralinvestmentproduct"),
        nullable=True,
    )
    first_investment_amount_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_investment_mode: Mapped[ReferralInvestmentMode | None] = mapped_column(
        Enum(ReferralInvestmentMode, name="referralinvestmentmode"),
        nullable=True,
    )
    qualified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    first_investment_reversed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    engaged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReferralEngagementEvent(Base):
    __tablename__ = "referral_engagement_events"
    __table_args__ = (
        UniqueConstraint(
            "attribution_id",
            "milestone_type",
            name="uq_referral_engagement_attribution_milestone",
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
    )
    milestone_type: Mapped[ReferralEngagementMilestone] = mapped_column(
        Enum(ReferralEngagementMilestone, name="referralengagementmilestone"),
        nullable=False,
    )
    product: Mapped[ReferralInvestmentProduct | None] = mapped_column(
        Enum(ReferralInvestmentProduct, name="referralinvestmentproduct"),
        nullable=True,
    )
    amount_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_aum_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    achieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
