"""Risk profile templates — Phase 2.

Revision ID: 054_risk_profile_templates
Revises: 053_risk_profile_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "054_risk_profile_templates"
down_revision: Union[str, None] = "053_risk_profile_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

risk_template_selection_mode = postgresql.ENUM(
    "manual",
    "auto",
    name="risktemplateselectionmode",
    create_type=False,
)

_RISK_AUDIT_EVENTS = (
    "risk_question_bulk_imported",
    "risk_template_created",
    "risk_template_updated",
)


def upgrade() -> None:
    bind = op.get_bind()
    risk_template_selection_mode.create(bind, checkfirst=True)

    for value in _RISK_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "risk_profile_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "selection_mode",
            risk_template_selection_mode,
            nullable=False,
            server_default="manual",
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
    )
    op.create_index(
        "ix_risk_profile_templates_active_sort",
        "risk_profile_templates",
        ["is_active", "sort_order"],
    )

    op.create_table(
        "risk_profile_template_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["template_id"], ["risk_profile_templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["risk_question_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "category_id", name="uq_risk_template_category"),
        sa.CheckConstraint("question_count >= 1", name="ck_risk_template_rule_min_questions"),
    )
    op.create_index("ix_risk_profile_template_rules_template_id", "risk_profile_template_rules", ["template_id"])

    op.add_column("risk_profile_assessments", sa.Column("template_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_risk_profile_assessments_template_id",
        "risk_profile_assessments",
        "risk_profile_templates",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_risk_profile_assessments_template_id", "risk_profile_assessments", type_="foreignkey")
    op.drop_column("risk_profile_assessments", "template_id")
    op.drop_index("ix_risk_profile_template_rules_template_id", table_name="risk_profile_template_rules")
    op.drop_table("risk_profile_template_rules")
    op.drop_index("ix_risk_profile_templates_active_sort", table_name="risk_profile_templates")
    op.drop_table("risk_profile_templates")
    risk_template_selection_mode.drop(op.get_bind(), checkfirst=True)
