"""Add line items to Mitra quick-transaction recommendations (multi-fund cart).

Revision ID: 091_mitra_txn_recommendation_items
Revises: 090_mitra_txn_recommendations
Create Date: 2026-08-29
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "091_mitra_txn_recommendation_items"
down_revision: Union[str, None] = "090_mitra_txn_recommendations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mitra_txn_recommendation_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("recommendation_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("amount_inr", sa.Numeric(14, 2), nullable=False),
        sa.Column("number_of_installments", sa.Integer(), nullable=True),
        sa.Column("installment_day", sa.Integer(), nullable=True),
        sa.Column("fund_name", sa.String(length=512), nullable=False),
        sa.Column("product_code", sa.String(length=64), nullable=True),
        sa.Column("fund_slug", sa.String(length=256), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["mitra_txn_recommendations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recommendation_id",
            "product_id",
            name="uq_mitra_txn_recommendation_items_rec_product",
        ),
    )
    op.create_index(
        "ix_mitra_txn_recommendation_items_recommendation_id",
        "mitra_txn_recommendation_items",
        ["recommendation_id"],
    )
    op.create_index(
        "ix_mitra_txn_recommendation_items_product_id",
        "mitra_txn_recommendation_items",
        ["product_id"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO mitra_txn_recommendation_items (
                id,
                recommendation_id,
                product_id,
                amount_inr,
                number_of_installments,
                installment_day,
                fund_name,
                product_code,
                fund_slug,
                display_order,
                created_at
            )
            SELECT
                gen_random_uuid(),
                id,
                product_id,
                amount_inr,
                number_of_installments,
                installment_day,
                fund_name,
                product_code,
                fund_slug,
                0,
                created_at
            FROM mitra_txn_recommendations
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_mitra_txn_recommendation_items_product_id", table_name="mitra_txn_recommendation_items")
    op.drop_index(
        "ix_mitra_txn_recommendation_items_recommendation_id",
        table_name="mitra_txn_recommendation_items",
    )
    op.drop_table("mitra_txn_recommendation_items")
