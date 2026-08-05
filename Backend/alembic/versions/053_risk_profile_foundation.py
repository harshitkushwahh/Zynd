"""Risk profile questionnaire foundation — Phase 1.

Revision ID: 053_risk_profile_foundation
Revises: 052_admin_invitations
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "053_risk_profile_foundation"
down_revision: Union[str, None] = "052_admin_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

risk_tier = postgresql.ENUM(
    "secure",
    "conservative",
    "moderate",
    "growth",
    "aggressive",
    name="risktier",
    create_type=False,
)

_RISK_AUDIT_EVENTS = (
    "risk_category_created",
    "risk_category_updated",
    "risk_question_created",
    "risk_question_updated",
    "risk_question_deleted",
    "risk_tier_config_updated",
    "risk_profile_completed",
)


def upgrade() -> None:
    bind = op.get_bind()
    risk_tier.create(bind, checkfirst=True)

    for value in _RISK_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "risk_question_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("weight", sa.Numeric(precision=6, scale=4), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "ix_risk_question_categories_active_sort",
        "risk_question_categories",
        ["is_active", "sort_order"],
    )

    op.create_table(
        "risk_questions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("help_text", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["risk_question_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_risk_questions_category_id", "risk_questions", ["category_id"])
    op.create_index(
        "ix_risk_questions_category_active_sort",
        "risk_questions",
        ["category_id", "is_active", "sort_order"],
    )

    op.create_table(
        "risk_question_options",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(length=512), nullable=False),
        sa.Column("score_value", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["question_id"], ["risk_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "sort_order", name="uq_risk_question_option_sort"),
        sa.CheckConstraint("score_value >= 0 AND score_value <= 100", name="ck_risk_option_score_range"),
    )
    op.create_index("ix_risk_question_options_question_id", "risk_question_options", ["question_id"])

    op.create_table(
        "risk_tier_config",
        sa.Column("tier", risk_tier, nullable=False),
        sa.Column("min_score", sa.Integer(), nullable=False),
        sa.Column("max_score", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("message_body", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("tier"),
        sa.CheckConstraint("min_score >= 0 AND max_score <= 1000", name="ck_risk_tier_score_bounds"),
        sa.CheckConstraint("min_score <= max_score", name="ck_risk_tier_min_max"),
    )

    op.create_table(
        "risk_profile_assessments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("tier", risk_tier, nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("score >= 0 AND score <= 1000", name="ck_risk_assessment_score_range"),
    )
    op.create_index("ix_risk_profile_assessments_user_id", "risk_profile_assessments", ["user_id"])
    op.create_index(
        "ix_risk_profile_assessments_user_completed",
        "risk_profile_assessments",
        ["user_id", "completed_at"],
    )

    op.create_table(
        "risk_profile_answers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("assessment_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("option_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["risk_profile_assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["risk_questions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["option_id"], ["risk_question_options.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id", "question_id", name="uq_risk_assessment_question"),
    )
    op.create_index("ix_risk_profile_answers_assessment_id", "risk_profile_answers", ["assessment_id"])

    op.create_table(
        "user_risk_profiles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("tier", risk_tier, nullable=False),
        sa.Column("assessment_id", sa.UUID(), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assessment_id"], ["risk_profile_assessments.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.CheckConstraint("score >= 0 AND score <= 1000", name="ck_user_risk_profile_score_range"),
    )

    op.execute(
        """
        INSERT INTO risk_tier_config (tier, min_score, max_score, title, message_body, sort_order)
        VALUES
            ('secure', 0, 199, 'Secure', 'Your risk profile is Secure. We recommend capital-preservation focused investments.', 1),
            ('conservative', 200, 399, 'Conservative', 'Your risk profile is Conservative. We recommend stable, low-volatility investments.', 2),
            ('moderate', 400, 599, 'Moderate', 'Your risk profile is Moderate. We recommend a balanced mix of stability and growth.', 3),
            ('growth', 600, 799, 'Growth', 'Your risk profile is Growth. We recommend growth-oriented investments with moderate volatility.', 4),
            ('aggressive', 800, 1000, 'Aggressive', 'Your risk profile is Aggressive. We recommend high-growth investments suited to your risk appetite.', 5)
        ON CONFLICT (tier) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("user_risk_profiles")
    op.drop_index("ix_risk_profile_answers_assessment_id", table_name="risk_profile_answers")
    op.drop_table("risk_profile_answers")
    op.drop_index("ix_risk_profile_assessments_user_completed", table_name="risk_profile_assessments")
    op.drop_index("ix_risk_profile_assessments_user_id", table_name="risk_profile_assessments")
    op.drop_table("risk_profile_assessments")
    op.drop_table("risk_tier_config")
    op.drop_index("ix_risk_question_options_question_id", table_name="risk_question_options")
    op.drop_table("risk_question_options")
    op.drop_index("ix_risk_questions_category_active_sort", table_name="risk_questions")
    op.drop_index("ix_risk_questions_category_id", table_name="risk_questions")
    op.drop_table("risk_questions")
    op.drop_index("ix_risk_question_categories_active_sort", table_name="risk_question_categories")
    op.drop_table("risk_question_categories")
    risk_tier.drop(op.get_bind(), checkfirst=True)
