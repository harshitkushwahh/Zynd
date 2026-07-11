"""Phase 3: KYC form submission (Cybrilla KYC Forms API).

Revision ID: 024_phase3_kyc_submission
Revises: 023_phase2_kyc_nominee_bank
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "024_phase3_kyc_submission"
down_revision: Union[str, None] = "023_phase2_kyc_nominee_bank"
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
    op.execute("ALTER TYPE kycoverallstatus ADD VALUE IF NOT EXISTS 'submitted'")

    op.add_column(
        "kyc_journey_states",
        sa.Column("signature_draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("external_kyc_form_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("kyc_form_status", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("kyc_form_type", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("kyc_form_failure_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("proof_details_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("esign_details_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "kyc_journey_states",
        sa.Column("geolocation_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.add_column(
        "user_kyc_status",
        sa.Column(
            "signature_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "user_kyc_status",
        sa.Column(
            "review_step_status",
            kyc_step_status,
            nullable=False,
            server_default="pending",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_kyc_status", "review_step_status")
    op.drop_column("user_kyc_status", "signature_step_status")
    op.drop_column("kyc_journey_states", "geolocation_json")
    op.drop_column("kyc_journey_states", "esign_details_status")
    op.drop_column("kyc_journey_states", "proof_details_status")
    op.drop_column("kyc_journey_states", "kyc_form_failure_reason")
    op.drop_column("kyc_journey_states", "kyc_form_type")
    op.drop_column("kyc_journey_states", "kyc_form_status")
    op.drop_column("kyc_journey_states", "external_kyc_form_id")
    op.drop_column("kyc_journey_states", "signature_draft_json")
