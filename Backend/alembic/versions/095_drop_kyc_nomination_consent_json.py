"""Drop legacy KYC journey nomination_consent_json after platform migration.

Revision ID: 095_drop_kyc_nomination_consent_json
Revises: 094_consent_rbac_backfill
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "095_drop_kyc_nomination_consent_json"
down_revision: Union[str, None] = "094_consent_rbac_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("kyc_journey_states", "nomination_consent_json")


def downgrade() -> None:
    op.add_column(
        "kyc_journey_states",
        sa.Column("nomination_consent_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
