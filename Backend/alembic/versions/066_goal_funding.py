"""Goal funding linkage — Phase 3 payment integration.

Revision ID: 066_goal_funding
Revises: 065_family_goals
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "066_goal_funding"
down_revision: Union[str, None] = "065_family_goals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_goal_contributions_source",
        "goal_contributions",
        ["source_type", "source_id"],
        unique=True,
        postgresql_where=sa.text("source_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_goal_contributions_source", table_name="goal_contributions")
