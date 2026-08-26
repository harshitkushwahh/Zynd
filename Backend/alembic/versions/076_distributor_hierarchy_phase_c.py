"""Distributor hierarchy Phase C: branch state codes and state head assignments.

Revision ID: 076_dist_hierarchy_c
Revises: 075_distributor_branches
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "076_dist_hierarchy_c"
down_revision: Union[str, None] = "075_distributor_branches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "distributor_branches",
        sa.Column("state_code", sa.String(length=8), nullable=False, server_default="MH"),
    )
    op.add_column(
        "distributor_branches",
        sa.Column("state_name", sa.String(length=80), nullable=False, server_default="Maharashtra"),
    )

    op.create_table(
        "distributor_state_heads",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("state_code", sa.String(length=8), nullable=False),
        sa.Column("state_name", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_distributor_state_heads_state_code", "distributor_state_heads", ["state_code"])


def downgrade() -> None:
    op.drop_index("ix_distributor_state_heads_state_code", table_name="distributor_state_heads")
    op.drop_table("distributor_state_heads")
    op.drop_column("distributor_branches", "state_name")
    op.drop_column("distributor_branches", "state_code")
