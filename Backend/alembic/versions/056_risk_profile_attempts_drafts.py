"""Risk profile attempt limits, server drafts, and unlock grants.

Revision ID: 056_risk_profile_attempts_drafts
Revises: 055_risk_profile_message_sent
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "056_risk_profile_attempts_drafts"
down_revision: Union[str, None] = "055_risk_profile_message_sent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_risk_profile_attempt_states",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("granted_attempts", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("completed_count >= 0", name="ck_risk_attempt_completed_nonneg"),
        sa.CheckConstraint("granted_attempts >= 1", name="ck_risk_attempt_granted_min"),
    )

    op.create_table(
        "risk_profile_assessment_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("risk_profile_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_ids", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("answers", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_risk_profile_assessment_draft_user"),
    )
    op.create_index("ix_risk_profile_assessment_drafts_user_id", "risk_profile_assessment_drafts", ["user_id"])

    op.create_table(
        "risk_profile_unlock_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("attempts_granted", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("attempts_granted >= 1", name="ck_risk_unlock_grant_min"),
    )
    op.create_index("ix_risk_profile_unlock_grants_user_id", "risk_profile_unlock_grants", ["user_id"])

    op.execute(
        """
        INSERT INTO user_risk_profile_attempt_states (user_id, completed_count, granted_attempts, locked_at)
        SELECT
            user_id,
            COUNT(*)::int AS completed_count,
            6 AS granted_attempts,
            CASE WHEN COUNT(*) >= 6 THEN MAX(completed_at) ELSE NULL END AS locked_at
        FROM risk_profile_assessments
        GROUP BY user_id
        ON CONFLICT (user_id) DO NOTHING
        """
    )

    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'risk_profile_locked'")
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'risk_profile_unlock_granted'")


def downgrade() -> None:
    op.drop_index("ix_risk_profile_unlock_grants_user_id", table_name="risk_profile_unlock_grants")
    op.drop_table("risk_profile_unlock_grants")
    op.drop_index("ix_risk_profile_assessment_drafts_user_id", table_name="risk_profile_assessment_drafts")
    op.drop_table("risk_profile_assessment_drafts")
    op.drop_table("user_risk_profile_attempt_states")
