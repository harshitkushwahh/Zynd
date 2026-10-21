"""Explicit mutual-fund links to a family group and optional goal.

Revision ID: 107_family_holding_links
Revises: 106_support_message_read_receipts
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "107_family_holding_links"
down_revision: Union[str, None] = "106_support_message_read_receipts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_holding_links",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("folio_number", sa.String(length=64), nullable=False),
        sa.Column("isin", sa.String(length=24), nullable=False),
        sa.Column("family_group_id", sa.UUID(), nullable=False),
        sa.Column("goal_id", sa.UUID(), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_group_id"], ["family_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "folio_number", "isin", name="uq_family_holding_link_folio"),
    )
    op.create_index("ix_family_holding_links_user_id", "family_holding_links", ["user_id"])
    op.create_index("ix_family_holding_links_family_group_id", "family_holding_links", ["family_group_id"])
    op.create_index("ix_family_holding_links_goal_id", "family_holding_links", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_family_holding_links_goal_id", table_name="family_holding_links")
    op.drop_index("ix_family_holding_links_family_group_id", table_name="family_holding_links")
    op.drop_index("ix_family_holding_links_user_id", table_name="family_holding_links")
    op.drop_table("family_holding_links")
