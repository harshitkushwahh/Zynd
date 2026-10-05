"""KYC nomination opt-out consent audit JSON on journey state.

Revision ID: 092_kyc_nomination_consent
Revises: 091_mitra_txn_recommendation_items
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "092_kyc_nomination_consent"
down_revision: Union[str, None] = "091_mitra_txn_recommendation_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_journey_states",
        sa.Column("nomination_consent_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kyc_journey_states", "nomination_consent_json")
