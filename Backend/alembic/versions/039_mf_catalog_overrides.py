"""MF catalog admin overrides — Phase 8.

Revision ID: 039_mf_catalog_overrides
Revises: 038_mf_admin_read_indexes
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "039_mf_catalog_overrides"
down_revision: Union[str, None] = "038_mf_admin_read_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MF_AUDIT_EVENTS = ("mf_fund_catalog_updated", "mf_amc_catalog_updated")


def upgrade() -> None:
    admin_visibility = postgresql.ENUM("AUTO", "FORCE_SHOW", "FORCE_HIDE", name="adminvisibility")
    admin_investability = postgresql.ENUM("AUTO", "BLOCK_ORDERS", name="admininvestability")
    admin_visibility.create(op.get_bind(), checkfirst=True)
    admin_investability.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "products",
        sa.Column(
            "admin_visibility",
            sa.Enum("AUTO", "FORCE_SHOW", "FORCE_HIDE", name="adminvisibility", create_type=False),
            nullable=False,
            server_default="AUTO",
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "admin_investability",
            sa.Enum("AUTO", "BLOCK_ORDERS", name="admininvestability", create_type=False),
            nullable=False,
            server_default="AUTO",
        ),
    )
    op.add_column("products", sa.Column("disabled_reason", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("disabled_by", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("products", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_products_disabled_by_users",
        "products",
        "users",
        ["disabled_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "fund_amcs",
        sa.Column("admin_kill_switch", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    for value in _MF_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_column("fund_amcs", "admin_kill_switch")
    op.drop_constraint("fk_products_disabled_by_users", "products", type_="foreignkey")
    op.drop_column("products", "disabled_at")
    op.drop_column("products", "disabled_by")
    op.drop_column("products", "disabled_reason")
    op.drop_column("products", "admin_investability")
    op.drop_column("products", "admin_visibility")
    op.execute("DROP TYPE IF EXISTS admininvestability")
    op.execute("DROP TYPE IF EXISTS adminvisibility")
