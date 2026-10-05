"""Persist FinPrim identity document snapshot on KYC journey.

Revision ID: 096_kyc_identity_document_json
Revises: 095_drop_kyc_nomination_consent_json
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "096_kyc_identity_document_json"
down_revision: Union[str, None] = "095_drop_kyc_nomination_consent_json"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_journey_states",
        sa.Column("external_identity_document_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kyc_journey_states", "external_identity_document_json")
