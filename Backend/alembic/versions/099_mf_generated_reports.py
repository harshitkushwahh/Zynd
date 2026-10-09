"""Investor generated reports storage.

Revision ID: 099_mf_generated_reports
Revises: 098_mf_switch_swp_stp
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "099_mf_generated_reports"
down_revision: Union[str, None] = "098_mf_switch_swp_stp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    kind = postgresql.ENUM(
        "account_statement",
        "capital_gains",
        "tax",
        name="mf_generated_report_kind",
        create_type=False,
    )
    status = postgresql.ENUM(
        "pending",
        "completed",
        "failed",
        name="mf_generated_report_status",
        create_type=False,
    )
    kind.create(bind, checkfirst=True)
    status.create(bind, checkfirst=True)

    op.create_table(
        "mf_generated_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", kind, nullable=False),
        sa.Column("period_from", sa.Date(), nullable=False),
        sa.Column("period_to", sa.Date(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_generated_reports_user_id", "mf_generated_reports", ["user_id"])
    op.create_index("ix_mf_generated_reports_status", "mf_generated_reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_mf_generated_reports_status", table_name="mf_generated_reports")
    op.drop_index("ix_mf_generated_reports_user_id", table_name="mf_generated_reports")
    op.drop_table("mf_generated_reports")
    postgresql.ENUM(name="mf_generated_report_status", create_type=False).drop(
        op.get_bind(), checkfirst=True
    )
    postgresql.ENUM(name="mf_generated_report_kind", create_type=False).drop(
        op.get_bind(), checkfirst=True
    )
