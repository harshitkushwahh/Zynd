"""Revision ID: 008_p0_security
Revises: 007_sprint5_deletion_retention
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008_p0_security"
down_revision: Union[str, None] = "007_sprint5_deletion_retention"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("token_family_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute("UPDATE sessions SET token_family_id = id WHERE token_family_id IS NULL")
    op.alter_column("sessions", "token_family_id", nullable=False)
    op.create_index("ix_sessions_token_family_id", "sessions", ["token_family_id"])
    op.execute(
        "ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'refresh_token_reuse_detected'"
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_token_family_id", table_name="sessions")
    op.drop_column("sessions", "token_family_id")
