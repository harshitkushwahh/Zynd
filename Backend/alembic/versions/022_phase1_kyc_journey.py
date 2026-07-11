"""Phase 1: KYC journey state tables.

Revision ID: 022_phase1_kyc_journey
Revises: 021_phase10_kyc_review
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "022_phase1_kyc_journey"
down_revision: Union[str, None] = "021_phase10_kyc_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

kyc_step_status = postgresql.ENUM(
    "pending",
    "verified",
    "failed",
    "skipped",
    "saved",
    name="kycstepstatus",
    create_type=False,
)
kyc_overall_status = postgresql.ENUM(
    "none",
    "in_progress",
    "phase1_complete",
    "completed",
    name="kycoverallstatus",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE kycstepstatus AS ENUM ('pending', 'verified', 'failed', 'skipped', 'saved');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE kycoverallstatus AS ENUM ('none', 'in_progress', 'phase1_complete', 'completed');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.create_table(
        "kyc_journey_states",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_completed_step", sa.String(length=32), nullable=True),
        sa.Column("pan_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("contact_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("personal_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("kyc_already_registered", sa.Boolean(), nullable=True),
        sa.Column("readiness_code", sa.String(length=64), nullable=True),
        sa.Column("readiness_reason", sa.Text(), nullable=True),
        sa.Column("pan_verification_status", sa.String(length=32), nullable=True),
        sa.Column("pan_verification_failure_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("external_kyc_request_id", sa.String(length=128), nullable=True),
        sa.Column("external_identity_document_id", sa.String(length=128), nullable=True),
        sa.Column("external_kyc_status", sa.String(length=64), nullable=True),
        sa.Column("digilocker_failure_reason", sa.Text(), nullable=True),
        sa.Column("poa_readiness_preverify_id", sa.String(length=128), nullable=True),
        sa.Column("poa_pan_preverify_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "ix_kyc_journey_states_external_identity_document_id",
        "kyc_journey_states",
        ["external_identity_document_id"],
        unique=False,
    )

    op.create_table(
        "user_kyc_status",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "pan_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "digilocker_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "address_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "personal_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "overall_status",
            kyc_overall_status,
            nullable=False,
            server_default="none",
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_kyc_status")
    op.drop_index("ix_kyc_journey_states_external_identity_document_id", table_name="kyc_journey_states")
    op.drop_table("kyc_journey_states")
    op.execute("DROP TYPE IF EXISTS kycoverallstatus")
    op.execute("DROP TYPE IF EXISTS kycstepstatus")
