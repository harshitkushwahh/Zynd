"""Store CAS cost so external holdings can sit in portfolio returns.

Revision ID: 110_mf_external_holding_cost
Revises: 109_kyc_poa_form_bound_pan
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "110_mf_external_holding_cost"
down_revision: Union[str, None] = "109_kyc_poa_form_bound_pan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mf_external_holdings",
        sa.Column("cost_value_inr", sa.Numeric(precision=18, scale=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mf_external_holdings", "cost_value_inr")
