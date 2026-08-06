"""Distributor branches and partner branch assignment.

Revision ID: 075_distributor_branches
Revises: 074_dist_partner_ho_review
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "075_distributor_branches"
down_revision: Union[str, None] = "074_dist_partner_ho_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "distributor_branches",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=True),
        sa.Column("manager_user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["manager_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("manager_user_id"),
    )
    op.create_index("ix_distributor_branches_manager_user_id", "distributor_branches", ["manager_user_id"])

    op.add_column(
        "distributor_partners",
        sa.Column("branch_id", sa.String(length=32), nullable=True),
    )
    op.create_foreign_key(
        "fk_distributor_partners_branch_id",
        "distributor_partners",
        "distributor_branches",
        ["branch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_distributor_partners_branch_id", "distributor_partners", ["branch_id"])


def downgrade() -> None:
    op.drop_index("ix_distributor_partners_branch_id", table_name="distributor_partners")
    op.drop_constraint("fk_distributor_partners_branch_id", "distributor_partners", type_="foreignkey")
    op.drop_column("distributor_partners", "branch_id")
    op.drop_index("ix_distributor_branches_manager_user_id", table_name="distributor_branches")
    op.drop_table("distributor_branches")
