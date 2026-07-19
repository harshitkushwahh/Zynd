"""MF enrichment — scheme master, return calculator, AUM ranks, compliance, AMC registry.

Revision ID: 044_mf_enrichment
Revises: 043_mf_invest_search_cache
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "044_mf_enrichment"
down_revision: Union[str, None] = "043_mf_invest_search_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "amfi_scheme_master",
        sa.Column("scheme_code", sa.String(length=32), primary_key=True),
        sa.Column("isin_growth", sa.String(length=24), nullable=False),
        sa.Column("isin_div_reinvestment", sa.String(length=24), nullable=True),
        sa.Column("scheme_name", sa.String(length=512), nullable=False),
        sa.Column("amc_name", sa.String(length=255), nullable=True),
        sa.Column("last_seen_nav_date", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_amfi_scheme_master_isin_growth", "amfi_scheme_master", ["isin_growth"])
    op.create_index("ix_amfi_scheme_master_isin_div", "amfi_scheme_master", ["isin_div_reinvestment"])

    op.create_table(
        "fund_return_calculator_snapshots",
        sa.Column("fund_id", sa.Integer(), sa.ForeignKey("mutual_funds.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("horizons", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "amc_aum_rankings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("amc_id", sa.Integer(), sa.ForeignKey("fund_amcs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("total_aum_inr", sa.Numeric(20, 2), nullable=False),
        sa.Column("rank_india", sa.Integer(), nullable=False),
        sa.Column("peer_count", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="AMFI_MONTHLY"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("amc_id", "as_of_date", name="uq_amc_aum_rankings_amc_date"),
    )
    op.create_index("ix_amc_aum_rankings_rank", "amc_aum_rankings", ["as_of_date", "rank_india"])

    op.create_table(
        "scheme_compliance_facts",
        sa.Column("fund_id", sa.Integer(), sa.ForeignKey("mutual_funds.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("exit_load_text", sa.Text(), nullable=True),
        sa.Column("exit_load_slabs", postgresql.JSONB(), nullable=True),
        sa.Column("stamp_duty_pct", sa.Numeric(8, 4), nullable=False, server_default="0.0050"),
        sa.Column("tax_notes", postgresql.JSONB(), nullable=True),
        sa.Column("lock_in_days", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="RULES"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "amc_registry",
        sa.Column("amc_id", sa.Integer(), sa.ForeignKey("fund_amcs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("incorporation_date", sa.Date(), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("website_url", sa.String(length=512), nullable=True),
        sa.Column("registered_address", sa.Text(), nullable=True),
        sa.Column("custodian", sa.String(length=255), nullable=True),
        sa.Column("rta_name", sa.String(length=128), nullable=True),
        sa.Column("rta_email", sa.String(length=255), nullable=True),
        sa.Column("rta_website", sa.String(length=512), nullable=True),
        sa.Column("rta_address", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="AMFI"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("amc_registry")
    op.drop_table("scheme_compliance_facts")
    op.drop_table("amc_aum_rankings")
    op.drop_table("fund_return_calculator_snapshots")
    op.drop_table("amfi_scheme_master")
