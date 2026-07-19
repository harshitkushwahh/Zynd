"""MF curated collections and fund derived attributes.

Revision ID: 046_mf_collections
Revises: 045_mf_investment_constraints
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "046_mf_collections"
down_revision: Union[str, None] = "045_mf_investment_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLLECTIONS = [
    ("high-return", "High Return", 110),
    ("best-sip", "Best SIP Funds", 120),
    ("gold-silver", "Gold & Silver", 130),
    ("large-cap", "Large Cap", 140),
    ("mid-cap", "Mid Cap", 150),
    ("small-cap", "Small Cap", 160),
]


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("category_kind", sa.String(length=32), nullable=False, server_default="BROWSE"),
    )

    op.create_table(
        "fund_derived_attributes",
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("cap_bucket", sa.String(length=32), nullable=True),
        sa.Column(
            "theme_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "classified_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("classification_version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("fund_id"),
    )
    op.create_index("ix_fund_derived_attributes_cap_bucket", "fund_derived_attributes", ["cap_bucket"])

    for slug, name, display_order in _COLLECTIONS:
        op.execute(
            sa.text(
                """
                INSERT INTO categories (slug, name, display_order, category_kind)
                VALUES (:slug, :name, :display_order, 'COLLECTION')
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    display_order = EXCLUDED.display_order,
                    category_kind = 'COLLECTION'
                """
            ).bindparams(slug=slug, name=name, display_order=display_order)
        )


def downgrade() -> None:
    for slug, _, _ in _COLLECTIONS:
        op.execute(
            sa.text("DELETE FROM product_categories WHERE category_id IN (SELECT id FROM categories WHERE slug = :slug)").bindparams(
                slug=slug
            )
        )
        op.execute(sa.text("DELETE FROM categories WHERE slug = :slug").bindparams(slug=slug))

    op.drop_index("ix_fund_derived_attributes_cap_bucket", table_name="fund_derived_attributes")
    op.drop_table("fund_derived_attributes")
    op.drop_column("categories", "category_kind")
