"""Investment risk profile questionnaire, scoring, and tier configuration."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _pg_enum(enum_cls: type[enum.Enum]):
    return Enum(enum_cls, values_callable=lambda members: [member.value for member in members])


class RiskTier(str, enum.Enum):
    secure = "secure"
    conservative = "conservative"
    moderate = "moderate"
    growth = "growth"
    aggressive = "aggressive"


class RiskQuestionCategory(Base):
    __tablename__ = "risk_question_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    questions: Mapped[list[RiskQuestion]] = relationship(
        "RiskQuestion",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class RiskQuestion(Base):
    __tablename__ = "risk_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_question_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    help_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[RiskQuestionCategory] = relationship("RiskQuestionCategory", back_populates="questions")
    options: Mapped[list[RiskQuestionOption]] = relationship(
        "RiskQuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="RiskQuestionOption.sort_order",
    )


class RiskQuestionOption(Base):
    __tablename__ = "risk_question_options"
    __table_args__ = (
        UniqueConstraint("question_id", "sort_order", name="uq_risk_question_option_sort"),
        CheckConstraint("score_value >= 0 AND score_value <= 100", name="ck_risk_option_score_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    score_value: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    question: Mapped[RiskQuestion] = relationship("RiskQuestion", back_populates="options")


class RiskTierConfig(Base):
    __tablename__ = "risk_tier_config"
    __table_args__ = (
        CheckConstraint("min_score >= 0 AND max_score <= 1000", name="ck_risk_tier_score_bounds"),
        CheckConstraint("min_score <= max_score", name="ck_risk_tier_min_max"),
    )

    tier: Mapped[RiskTier] = mapped_column(_pg_enum(RiskTier), primary_key=True)
    min_score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RiskProfileAssessment(Base):
    __tablename__ = "risk_profile_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[RiskTier] = mapped_column(_pg_enum(RiskTier), nullable=False)
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)

    answers: Mapped[list[RiskProfileAnswer]] = relationship(
        "RiskProfileAnswer",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )


class RiskProfileAnswer(Base):
    __tablename__ = "risk_profile_answers"
    __table_args__ = (UniqueConstraint("assessment_id", "question_id", name="uq_risk_assessment_question"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_questions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_question_options.id", ondelete="RESTRICT"),
        nullable=False,
    )
    answer_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    assessment: Mapped[RiskProfileAssessment] = relationship("RiskProfileAssessment", back_populates="answers")


class UserRiskProfile(Base):
    __tablename__ = "user_risk_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[RiskTier] = mapped_column(_pg_enum(RiskTier), nullable=False)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_assessments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RiskTemplateSelectionMode(str, enum.Enum):
    manual = "manual"
    auto = "auto"


class RiskProfileTemplate(Base):
    __tablename__ = "risk_profile_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    selection_mode: Mapped[RiskTemplateSelectionMode] = mapped_column(
        _pg_enum(RiskTemplateSelectionMode),
        nullable=False,
        default=RiskTemplateSelectionMode.manual,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    rules: Mapped[list[RiskProfileTemplateRule]] = relationship(
        "RiskProfileTemplateRule",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="RiskProfileTemplateRule.sort_order",
    )


class RiskProfileTemplateRule(Base):
    __tablename__ = "risk_profile_template_rules"
    __table_args__ = (
        UniqueConstraint("template_id", "category_id", name="uq_risk_template_category"),
        CheckConstraint("question_count >= 1", name="ck_risk_template_rule_min_questions"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_question_categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped[RiskProfileTemplate] = relationship("RiskProfileTemplate", back_populates="rules")
    category: Mapped[RiskQuestionCategory] = relationship("RiskQuestionCategory")


class UserRiskProfileAttemptState(Base):
    """Tracks completed assessment attempts and lock state per user."""

    __tablename__ = "user_risk_profile_attempt_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    granted_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RiskProfileAssessmentDraft(Base):
    """In-progress assessment session persisted server-side."""

    __tablename__ = "risk_profile_assessment_drafts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    question_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RiskProfileReportCache(Base):
    """Cached PDF report generated for a completed assessment."""

    __tablename__ = "risk_profile_report_cache"
    __table_args__ = (UniqueConstraint("assessment_id", name="uq_risk_profile_report_assessment"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_profile_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    storage_bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RiskProfileUnlockGrant(Base):
    """Audit record when an admin grants additional attempts after OTP verification."""

    __tablename__ = "risk_profile_unlock_grants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    attempts_granted: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
