"""Referral Stage 2 — KYC verified stage.

Revision ID: 028_referral_stage2
Revises: 027_referral_stage1
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028_referral_stage2"
down_revision: Union[str, None] = "027_referral_stage1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'kyc_verified'")
    op.add_column(
        "referral_attributions",
        sa.Column("kyc_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_referral_attributions_kyc_verified_at",
        "referral_attributions",
        ["kyc_verified_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_referral_attributions_kyc_verified_at", table_name="referral_attributions")
    op.drop_column("referral_attributions", "kyc_verified_at")
