"""Family goals — contributions and activity.

Revision ID: 065_family_goals
Revises: 064_goals_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "065_family_goals"
down_revision: Union[str, None] = "064_goals_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

goal_contribution_source_type = postgresql.ENUM(
    "manual",
    "sip_plan",
    "lumpsum_order",
    name="goalcontributionsourcetype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    goal_contribution_source_type.create(bind, checkfirst=True)

    for value in (
        "goal.created",
        "goal.updated",
        "goal.contribution_added",
        "goal.archived",
    ):
        op.execute(f"ALTER TYPE familygroupactivitytype ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("goals", sa.Column("created_by_user_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_goals_created_by_user_id",
        "goals",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_goals_created_by_user_id", "goals", ["created_by_user_id"])

    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("goal_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("source_type", goal_contribution_source_type, nullable=False, server_default="manual"),
        sa.Column("source_id", sa.UUID(), nullable=True),
        sa.Column("note", sa.String(length=120), nullable=True),
        sa.Column("contributed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount_inr > 0", name="ck_goal_contribution_amount_positive"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goal_contributions_goal_id", "goal_contributions", ["goal_id"])
    op.create_index("ix_goal_contributions_user_id", "goal_contributions", ["user_id"])
    op.create_index("ix_goal_contributions_contributed_at", "goal_contributions", ["contributed_at"])


def downgrade() -> None:
    op.drop_index("ix_goal_contributions_contributed_at", table_name="goal_contributions")
    op.drop_index("ix_goal_contributions_user_id", table_name="goal_contributions")
    op.drop_index("ix_goal_contributions_goal_id", table_name="goal_contributions")
    op.drop_table("goal_contributions")
    op.drop_index("ix_goals_created_by_user_id", table_name="goals")
    op.drop_constraint("fk_goals_created_by_user_id", "goals", type_="foreignkey")
    op.drop_column("goals", "created_by_user_id")
    goal_contribution_source_type.drop(op.get_bind(), checkfirst=True)
