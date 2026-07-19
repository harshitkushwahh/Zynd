"""MF investment constraints JSON on mutual_funds.

Revision ID: 045_mf_investment_constraints
Revises: 044_mf_enrichment
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "045_mf_investment_constraints"
down_revision: Union[str, None] = "044_mf_enrichment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mutual_funds",
        sa.Column("investment_constraints", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mutual_funds", "investment_constraints")
