"""Remove learned ONDC SIP blocks from mutual fund investment constraints.

Revision ID: 087_remove_ondc_sip_learned_blocks
Revises: 086_backfill_user_names_from_kyc_pan
Create Date: 2026-08-25
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "087_remove_ondc_sip_learned_blocks"
down_revision: Union[str, None] = "086_backfill_user_names_from_kyc_pan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE mutual_funds
        SET investment_constraints = investment_constraints - 'ondc_sip'
        WHERE investment_constraints ? 'ondc_sip'
        """
    )


def downgrade() -> None:
    pass
