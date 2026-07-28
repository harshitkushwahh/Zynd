"""Goal portfolio linkage — Phase 4.

Revision ID: 067_goal_portfolio
Revises: 066_goal_funding
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "067_goal_portfolio"
down_revision: Union[str, None] = "066_goal_funding"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("goals", sa.Column("linked_product_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_goals_linked_product_id",
        "goals",
        "products",
        ["linked_product_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_goals_linked_product_id", "goals", ["linked_product_id"])


def downgrade() -> None:
    op.drop_index("ix_goals_linked_product_id", table_name="goals")
    op.drop_constraint("fk_goals_linked_product_id", "goals", type_="foreignkey")
    op.drop_column("goals", "linked_product_id")
