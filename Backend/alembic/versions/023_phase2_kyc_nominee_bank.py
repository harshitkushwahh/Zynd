"""Phase 2: KYC nominee + bank journey fields.

Revision ID: 023_phase2_kyc_nominee_bank
Revises: 022_phase1_kyc_journey
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023_phase2_kyc_nominee_bank"
down_revision: Union[str, None] = "022_phase1_kyc_journey"
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


def upgrade() -> None:
    op.execute("ALTER TYPE kycoverallstatus ADD VALUE IF NOT EXISTS 'phase2_complete'")

    op.add_column(
        "kyc_journey_states",
        sa.Column("nominee_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("bank_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("poa_bank_preverify_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("poa_bank_proof_file_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("bank_verification_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("bank_verification_failure_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.add_column(
        "user_kyc_status",
        sa.Column(
            "nominee_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "user_kyc_status",
        sa.Column(
            "bank_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_kyc_status", "bank_step_status")
    op.drop_column("user_kyc_status", "nominee_step_status")
    op.drop_column("kyc_journey_states", "bank_verification_failure_json")
    op.drop_column("kyc_journey_states", "bank_verification_status")
    op.drop_column("kyc_journey_states", "poa_bank_proof_file_id")
    op.drop_column("kyc_journey_states", "poa_bank_preverify_id")
    op.drop_column("kyc_journey_states", "bank_draft_json")
    op.drop_column("kyc_journey_states", "nominee_draft_json")
