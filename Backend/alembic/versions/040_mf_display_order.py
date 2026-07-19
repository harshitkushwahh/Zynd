"""MF category display order — Phase 9.

Revision ID: 040_mf_display_order
Revises: 039_mf_catalog_overrides
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "040_mf_display_order"
down_revision: Union[str, None] = "039_mf_catalog_overrides"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MF_AUDIT_EVENTS = ("mf_category_catalog_updated",)


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "categories",
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "categories",
        sa.Column("min_funds_to_show", sa.Integer(), nullable=False, server_default="1"),
    )

    op.add_column(
        "product_categories",
        sa.Column("display_order", sa.Integer(), nullable=True),
    )
    op.add_column(
        "product_categories",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "product_categories",
        sa.Column("featured_rank", sa.Integer(), nullable=True),
    )
    op.add_column(
        "product_categories",
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "product_categories",
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_product_categories_category_display_order",
        "product_categories",
        ["category_id", "display_order"],
        unique=False,
    )
    op.create_index(
        "ix_categories_display_order",
        "categories",
        ["display_order"],
        unique=False,
    )

    for value in _MF_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_index("ix_categories_display_order", table_name="categories")
    op.drop_index("ix_product_categories_category_display_order", table_name="product_categories")
    op.drop_column("product_categories", "effective_until")
    op.drop_column("product_categories", "effective_from")
    op.drop_column("product_categories", "featured_rank")
    op.drop_column("product_categories", "is_featured")
    op.drop_column("product_categories", "display_order")
    op.drop_column("categories", "min_funds_to_show")
    op.drop_column("categories", "is_visible")
    op.drop_column("categories", "display_order")
