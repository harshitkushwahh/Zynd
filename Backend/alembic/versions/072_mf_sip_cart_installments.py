"""Add number_of_installments to MF cart items.

Revision ID: 072_mf_sip_cart_installments
Revises: 071_fund_gate_contact_only
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "072_mf_sip_cart_installments"
down_revision: Union[str, None] = "071_fund_gate_contact_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mf_cart_items", sa.Column("number_of_installments", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("mf_cart_items", "number_of_installments")
