"""Phase 10: KYC review status + nominee_id document type.

Revision ID: 021_phase10_kyc_review
Revises: 020_phase8_document_retention
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021_phase10_kyc_review"
down_revision: Union[str, None] = "020_phase8_document_retention"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_KYC_AUDIT_EVENTS = ("document_kyc_rejected",)


def upgrade() -> None:
    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'nominee_id'")
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE kycreviewstatus AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.add_column(
        "user_documents",
        sa.Column(
            "kyc_review_status",
            sa.Enum("pending", "approved", "rejected", name="kycreviewstatus", create_type=False),
            nullable=True,
        ),
    )
    for value in _KYC_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_column("user_documents", "kyc_review_status")
    op.execute("DROP TYPE IF EXISTS kycreviewstatus")
