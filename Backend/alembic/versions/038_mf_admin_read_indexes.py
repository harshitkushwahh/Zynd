"""MF admin catalog read indexes — Phase 7.

Revision ID: 038_mf_admin_read_indexes
Revises: 037_mf_transactions
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "038_mf_admin_read_indexes"
down_revision: Union[str, None] = "037_mf_transactions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_mutual_funds_amc_id", "mutual_funds", ["amc_id"], unique=False)
    op.create_index("ix_mutual_funds_is_active", "mutual_funds", ["is_active"], unique=False)
    op.create_index("ix_products_lifecycle_status", "products", ["lifecycle_status"], unique=False)
    op.create_index("ix_scheme_navs_fund_id_nav_date", "scheme_navs", ["fund_id", "nav_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scheme_navs_fund_id_nav_date", table_name="scheme_navs")
    op.drop_index("ix_products_lifecycle_status", table_name="products")
    op.drop_index("ix_mutual_funds_is_active", table_name="mutual_funds")
    op.drop_index("ix_mutual_funds_amc_id", table_name="mutual_funds")
