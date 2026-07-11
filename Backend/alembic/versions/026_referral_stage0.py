"""Referral Stage 0 — referral codes and click tracking.

Revision ID: 026_referral_stage0
Revises: 025_investor_profile_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "026_referral_stage0"
down_revision: Union[str, None] = "025_investor_profile_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "referral_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_referral_codes_code", "referral_codes", ["code"], unique=True)
    op.create_index("ix_referral_codes_user_id", "referral_codes", ["user_id"], unique=True)

    op.create_table(
        "referral_clicks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referral_code_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referrer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("user_agent_snippet", sa.String(length=255), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["referral_code_id"], ["referral_codes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referrer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_referral_clicks_referral_code_id", "referral_clicks", ["referral_code_id"])
    op.create_index("ix_referral_clicks_referrer_user_id", "referral_clicks", ["referrer_user_id"])
    op.create_index("ix_referral_clicks_clicked_at", "referral_clicks", ["clicked_at"])


def downgrade() -> None:
    op.drop_index("ix_referral_clicks_clicked_at", table_name="referral_clicks")
    op.drop_index("ix_referral_clicks_referrer_user_id", table_name="referral_clicks")
    op.drop_index("ix_referral_clicks_referral_code_id", table_name="referral_clicks")
    op.drop_table("referral_clicks")
    op.drop_index("ix_referral_codes_user_id", table_name="referral_codes")
    op.drop_index("ix_referral_codes_code", table_name="referral_codes")
    op.drop_table("referral_codes")
