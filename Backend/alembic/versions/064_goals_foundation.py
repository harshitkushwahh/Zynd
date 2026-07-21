"""Goals foundation — templates and personal goals.

Revision ID: 064_goals_foundation
Revises: 063_family_group_kyc_bridge
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "064_goals_foundation"
down_revision: Union[str, None] = "063_family_group_kyc_bridge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

goal_status = postgresql.ENUM(
    "draft",
    "active",
    "achieved",
    "paused",
    "archived",
    name="goalstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    goal_status.create(bind, checkfirst=True)

    op.create_table(
        "goal_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon_key", sa.String(length=32), nullable=False, server_default="target"),
        sa.Column("default_tenure_months", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("suggested_return_pct", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("default_tenure_months >= 1", name="ck_goal_template_tenure_min"),
        sa.CheckConstraint(
            "suggested_return_pct IS NULL OR (suggested_return_pct >= 0 AND suggested_return_pct <= 100)",
            name="ck_goal_template_return_range",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_goal_templates_is_active", "goal_templates", ["is_active"])
    op.create_index("ix_goal_templates_sort_order", "goal_templates", ["sort_order"])

    op.create_table(
        "goals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("family_group_id", sa.UUID(), nullable=True),
        sa.Column("template_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("tag", sa.String(length=32), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("target_amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("current_amount_inr", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("existing_savings_inr", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"),
        sa.Column("expected_return_pct", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("status", goal_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("target_amount_inr > 0", name="ck_goal_target_positive"),
        sa.CheckConstraint("current_amount_inr >= 0", name="ck_goal_current_non_negative"),
        sa.CheckConstraint("existing_savings_inr >= 0", name="ck_goal_savings_non_negative"),
        sa.CheckConstraint("priority >= 1 AND priority <= 5", name="ck_goal_priority_range"),
        sa.ForeignKeyConstraint(["family_group_id"], ["family_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["goal_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])
    op.create_index("ix_goals_family_group_id", "goals", ["family_group_id"])
    op.create_index("ix_goals_template_id", "goals", ["template_id"])
    op.create_index("ix_goals_status", "goals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_goals_status", table_name="goals")
    op.drop_index("ix_goals_template_id", table_name="goals")
    op.drop_index("ix_goals_family_group_id", table_name="goals")
    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")
    op.drop_index("ix_goal_templates_sort_order", table_name="goal_templates")
    op.drop_index("ix_goal_templates_is_active", table_name="goal_templates")
    op.drop_table("goal_templates")
    goal_status.drop(op.get_bind(), checkfirst=True)
