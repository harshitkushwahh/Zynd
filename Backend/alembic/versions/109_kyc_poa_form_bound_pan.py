"""Store PAN scoped to bound Cybrilla kyc_form id.

Revision ID: 109_kyc_poa_form_bound_pan
Revises: 108_zto_lookup_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "109_kyc_poa_form_bound_pan"
down_revision: Union[str, None] = "108_zto_lookup_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_journey_states",
        sa.Column("poa_kyc_form_bound_pan", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kyc_journey_states", "poa_kyc_form_bound_pan")
