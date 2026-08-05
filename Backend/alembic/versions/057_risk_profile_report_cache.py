"""Risk profile PDF report cache.

Revision ID: 057_risk_profile_report_cache
Revises: 056_risk_profile_attempts_drafts
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "057_risk_profile_report_cache"
down_revision: Union[str, None] = "056_risk_profile_attempts_drafts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "risk_profile_report_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "assessment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("risk_profile_assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_bucket", sa.String(length=128), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("assessment_id", name="uq_risk_profile_report_assessment"),
    )
    op.create_index("ix_risk_profile_report_cache_user_id", "risk_profile_report_cache", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_risk_profile_report_cache_user_id", table_name="risk_profile_report_cache")
    op.drop_table("risk_profile_report_cache")
