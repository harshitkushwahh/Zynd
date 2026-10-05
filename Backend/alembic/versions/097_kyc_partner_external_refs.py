"""Store immutable Cybrilla / partner external IDs on KYC journey.

Revision ID: 097_kyc_partner_external_refs
Revises: 096_kyc_identity_document_json
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "097_kyc_partner_external_refs"
down_revision: Union[str, None] = "096_kyc_identity_document_json"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_journey_states",
        sa.Column("kyc_partner_external_refs_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kyc_journey_states", "kyc_partner_external_refs_json")
