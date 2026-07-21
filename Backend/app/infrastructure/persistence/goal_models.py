"""Financial goals — personal and family (Phase 1: personal goals)."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _pg_enum(enum_cls: type[enum.Enum]):
    return Enum(enum_cls, values_callable=lambda members: [member.value for member in members])


class GoalStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    achieved = "achieved"
    paused = "paused"
    archived = "archived"


class GoalContributionSourceType(str, enum.Enum):
    manual = "manual"
    sip_plan = "sip_plan"
    lumpsum_order = "lumpsum_order"


class GoalTemplate(Base):
    __tablename__ = "goal_templates"
    __table_args__ = (
        CheckConstraint("default_tenure_months >= 1", name="ck_goal_template_tenure_min"),
        CheckConstraint(
            "suggested_return_pct IS NULL OR (suggested_return_pct >= 0 AND suggested_return_pct <= 100)",
            name="ck_goal_template_return_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon_key: Mapped[str] = mapped_column(String(32), nullable=False, default="target")
    default_tenure_months: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    suggested_return_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("target_amount_inr > 0", name="ck_goal_target_positive"),
        CheckConstraint("current_amount_inr >= 0", name="ck_goal_current_non_negative"),
        CheckConstraint("existing_savings_inr >= 0", name="ck_goal_savings_non_negative"),
        CheckConstraint("priority >= 1 AND priority <= 5", name="ck_goal_priority_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    family_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("goal_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    tag: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    target_amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    existing_savings_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    expected_return_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[GoalStatus] = mapped_column(_pg_enum(GoalStatus), nullable=False, default=GoalStatus.active)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    template: Mapped[Optional[GoalTemplate]] = relationship("GoalTemplate")
    contributions: Mapped[list[GoalContribution]] = relationship(
        "GoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
    )


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (CheckConstraint("amount_inr > 0", name="ck_goal_contribution_amount_positive"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    source_type: Mapped[GoalContributionSourceType] = mapped_column(
        _pg_enum(GoalContributionSourceType),
        nullable=False,
        default=GoalContributionSourceType.manual,
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    contributed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    goal: Mapped[Goal] = relationship("Goal", back_populates="contributions")
