"""MF analytics — fund_nav_metrics, fund_composite_ranks, scheme_aums, scheme_ter.

Revision ID: 036_mf_analytics
Revises: 035_mf_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "036_mf_analytics"
down_revision: Union[str, None] = "035_mf_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fund_nav_metrics",
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("return_1d", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_1w", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_1m", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_3m", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_6m", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_1y", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_3y", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("return_5y", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("fund_id"),
    )

    op.create_table(
        "fund_composite_ranks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("rank_score", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("rank_position", sa.Integer(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fund_id", "category_id", name="uq_fund_composite_ranks"),
    )

    op.create_table(
        "scheme_aums",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("aum_inr", sa.Numeric(precision=20, scale=2), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="AMFI", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fund_id", "as_of_date", name="uq_scheme_aums_fund_date"),
    )

    op.create_table(
        "scheme_ter",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("ter_percent", sa.Numeric(precision=8, scale=4), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="AMFI", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fund_id", "as_of_date", name="uq_scheme_ter_fund_date"),
    )


def downgrade() -> None:
    op.drop_table("scheme_ter")
    op.drop_table("scheme_aums")
    op.drop_table("fund_composite_ranks")
    op.drop_table("fund_nav_metrics")
