"""Branch opening workflow: status, codes, optional manager, creator audit.

Revision ID: 077_dist_branch_workflow
Revises: 076_dist_hierarchy_c
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "077_dist_branch_workflow"
down_revision: Union[str, None] = "076_dist_hierarchy_c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

branch_status = sa.Enum(
    "pending_approval",
    "active",
    "rejected",
    name="distributor_branch_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    branch_status.create(bind, checkfirst=True)

    op.add_column("distributor_branches", sa.Column("branch_code", sa.String(length=16), nullable=True))
    op.add_column(
        "distributor_branches",
        sa.Column(
            "status",
            branch_status,
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column("distributor_branches", sa.Column("created_by_user_id", sa.UUID(), nullable=True))
    op.add_column("distributor_branches", sa.Column("approved_by_user_id", sa.UUID(), nullable=True))
    op.add_column("distributor_branches", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("distributor_branches", sa.Column("rejection_reason", sa.String(length=240), nullable=True))

    op.create_foreign_key(
        "fk_distributor_branches_created_by_user_id",
        "distributor_branches",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_distributor_branches_approved_by_user_id",
        "distributor_branches",
        "users",
        ["approved_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_distributor_branches_status", "distributor_branches", ["status"])
    op.create_index("ix_distributor_branches_branch_code", "distributor_branches", ["branch_code"])

    op.alter_column("distributor_branches", "manager_user_id", existing_type=sa.UUID(), nullable=True)

    op.execute(
        """
        UPDATE distributor_branches
        SET branch_code = UPPER(REPLACE(id, '-', ''))
        WHERE branch_code IS NULL
        """
    )


def downgrade() -> None:
    op.alter_column("distributor_branches", "manager_user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_distributor_branches_branch_code", table_name="distributor_branches")
    op.drop_index("ix_distributor_branches_status", table_name="distributor_branches")
    op.drop_constraint("fk_distributor_branches_approved_by_user_id", "distributor_branches", type_="foreignkey")
    op.drop_constraint("fk_distributor_branches_created_by_user_id", "distributor_branches", type_="foreignkey")
    op.drop_column("distributor_branches", "rejection_reason")
    op.drop_column("distributor_branches", "approved_at")
    op.drop_column("distributor_branches", "approved_by_user_id")
    op.drop_column("distributor_branches", "created_by_user_id")
    op.drop_column("distributor_branches", "status")
    op.drop_column("distributor_branches", "branch_code")
    branch_status.drop(op.get_bind(), checkfirst=True)
