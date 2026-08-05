"""Risk profile answer snapshots and option soft-delete.

Revision ID: 058_risk_answer_snapshots
Revises: 057_risk_profile_report_cache
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "058_risk_answer_snapshots"
down_revision: Union[str, None] = "057_risk_profile_report_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "risk_question_options",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "risk_profile_answers",
        sa.Column("answer_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("risk_profile_answers", "answer_snapshot")
    op.drop_column("risk_question_options", "is_active")
