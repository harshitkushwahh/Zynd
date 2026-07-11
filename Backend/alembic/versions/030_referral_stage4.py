"""Referral Stage 4 — qualified stage after investment hold.

Revision ID: 030_referral_stage4
Revises: 029_referral_stage3
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "030_referral_stage4"
down_revision: Union[str, None] = "029_referral_stage3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'qualified'")

    op.add_column(
        "referral_attributions",
        sa.Column("qualified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "referral_attributions",
        sa.Column("first_investment_reversed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_referral_attributions_qualified_at",
        "referral_attributions",
        ["qualified_at"],
    )
    op.create_index(
        "ix_referral_attributions_first_investment_reversed_at",
        "referral_attributions",
        ["first_investment_reversed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_referral_attributions_first_investment_reversed_at",
        table_name="referral_attributions",
    )
    op.drop_index("ix_referral_attributions_qualified_at", table_name="referral_attributions")
    op.drop_column("referral_attributions", "first_investment_reversed_at")
    op.drop_column("referral_attributions", "qualified_at")
