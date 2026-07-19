"""MF invest search vectors & cache scale — Phase 14.

Revision ID: 043_mf_invest_search_cache
Revises: 042_mf_catalog_rules
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "043_mf_invest_search_cache"
down_revision: Union[str, None] = "042_mf_catalog_rules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("invest_search_vector", postgresql.TSVECTOR(), nullable=True),
    )
    op.create_index(
        "ix_products_invest_search_vector",
        "products",
        ["invest_search_vector"],
        unique=False,
        postgresql_using="gin",
    )
    op.execute(
        """
        UPDATE products p
        SET invest_search_vector = to_tsvector(
            'simple',
            coalesce(p.name, '') || ' ' || coalesce(p.code, '') || ' ' ||
            coalesce(mf.scheme_name, '') || ' ' || coalesce(mf.isin_growth, '') || ' ' ||
            coalesce(amc.name, '')
        )
        FROM mutual_funds mf
        JOIN fund_amcs amc ON amc.id = mf.amc_id
        WHERE mf.product_id = p.id
        """
    )


def downgrade() -> None:
    op.drop_index("ix_products_invest_search_vector", table_name="products")
    op.drop_column("products", "invest_search_vector")
