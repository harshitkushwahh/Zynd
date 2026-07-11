"""Referral Stage 3 — first investment stage.

Revision ID: 029_referral_stage3
Revises: 028_referral_stage2
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "029_referral_stage3"
down_revision: Union[str, None] = "028_referral_stage2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

referral_investment_product = postgresql.ENUM(
    "mutual_fund",
    "fixed_deposit",
    "other",
    name="referralinvestmentproduct",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    referral_investment_product.create(bind, checkfirst=True)
    op.execute("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'first_investment'")

    op.add_column(
        "referral_attributions",
        sa.Column("first_investment_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "referral_attributions",
        sa.Column(
            "first_investment_product",
            referral_investment_product,
            nullable=True,
        ),
    )
    op.add_column(
        "referral_attributions",
        sa.Column("first_investment_amount_inr", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_referral_attributions_first_investment_at",
        "referral_attributions",
        ["first_investment_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_referral_attributions_first_investment_at", table_name="referral_attributions")
    op.drop_column("referral_attributions", "first_investment_amount_inr")
    op.drop_column("referral_attributions", "first_investment_product")
    op.drop_column("referral_attributions", "first_investment_at")
    referral_investment_product.drop(op.get_bind(), checkfirst=True)
