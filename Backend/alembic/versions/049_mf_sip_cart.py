"""Add SIP fields to MF cart items.

Revision ID: 049_mf_sip_cart
Revises: 048_mf_sip_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "049_mf_sip_cart"
down_revision: Union[str, None] = "048_mf_sip_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    investment_type = sa.Enum("lumpsum", "sip", name="mf_cart_investment_type")
    investment_type.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "mf_cart_items",
        sa.Column(
            "investment_type",
            investment_type,
            nullable=False,
            server_default="lumpsum",
        ),
    )
    op.add_column("mf_cart_items", sa.Column("installment_day", sa.Integer(), nullable=True))
    op.add_column(
        "mf_cart_items",
        sa.Column("frequency", sa.String(length=16), nullable=False, server_default="monthly"),
    )

    op.drop_constraint("uq_mf_cart_items_user_product", "mf_cart_items", type_="unique")
    op.create_unique_constraint(
        "uq_mf_cart_items_user_product_type",
        "mf_cart_items",
        ["user_id", "product_id", "investment_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_mf_cart_items_user_product_type", "mf_cart_items", type_="unique")
    op.create_unique_constraint(
        "uq_mf_cart_items_user_product",
        "mf_cart_items",
        ["user_id", "product_id"],
    )
    op.drop_column("mf_cart_items", "frequency")
    op.drop_column("mf_cart_items", "installment_day")
    op.drop_column("mf_cart_items", "investment_type")
    sa.Enum(name="mf_cart_investment_type").drop(op.get_bind(), checkfirst=True)
