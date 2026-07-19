"""Mutual fund foundation — scheme master, NAV, products, ingestion logs.

Revision ID: 035_mf_foundation
Revises: 034_notification_phase5
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "035_mf_foundation"
down_revision: Union[str, None] = "034_notification_phase5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

product_type = postgresql.ENUM("MUTUAL_FUND", name="producttype", create_type=False)
product_lifecycle = postgresql.ENUM("DRAFT", "ACTIVE", "INACTIVE", name="productlifecyclestatus", create_type=False)
ingestion_status = postgresql.ENUM(
    "RUNNING", "SUCCEEDED", "FAILED", "PARTIAL", name="ingestionrunstatus", create_type=False
)


def upgrade() -> None:
    product_type.create(op.get_bind(), checkfirst=True)
    product_lifecycle.create(op.get_bind(), checkfirst=True)
    ingestion_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "fund_amcs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("amc_code", sa.String(length=32), nullable=True),
        sa.Column("fp_amc_id", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("logo_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("amc_code"),
        sa.UniqueConstraint("fp_amc_id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("short_description", sa.String(length=1024), nullable=True),
        sa.Column("provider", sa.String(length=255), nullable=True),
        sa.Column("product_type", product_type, nullable=False),
        sa.Column("lifecycle_status", product_lifecycle, server_default="DRAFT", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "mutual_funds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("amc_id", sa.Integer(), nullable=False),
        sa.Column("scheme_code", sa.String(length=32), nullable=True),
        sa.Column("isin_growth", sa.String(length=24), nullable=False),
        sa.Column("isin_div_reinvestment", sa.String(length=24), nullable=True),
        sa.Column("scheme_name", sa.String(length=512), nullable=False),
        sa.Column("fp_scheme_id", sa.String(length=128), nullable=True),
        sa.Column("fp_oms_purchase_allowed", sa.Boolean(), nullable=True),
        sa.Column("fp_oms_active", sa.Boolean(), nullable=True),
        sa.Column("min_sip_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("min_lumpsum_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("sebi_category", sa.String(length=128), nullable=True),
        sa.Column("plan_type", sa.String(length=32), nullable=True),
        sa.Column("option_type", sa.String(length=32), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["amc_id"], ["fund_amcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_scheme_id"),
        sa.UniqueConstraint("isin_growth"),
        sa.UniqueConstraint("product_id"),
    )
    op.create_index("ix_mutual_funds_scheme_code", "mutual_funds", ["scheme_code"])

    op.create_table(
        "scheme_navs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("nav_date", sa.Date(), nullable=False),
        sa.Column("nav_value", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("repurchase_price", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("sale_price", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("source", sa.String(length=32), server_default="AMFI", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fund_id", "nav_date", name="uq_scheme_navs_fund_date"),
    )

    op.create_table(
        "product_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "category_id", name="uq_product_categories"),
    )

    op.create_table(
        "ingestion_run_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_name", sa.String(length=64), nullable=False),
        sa.Column("status", ingestion_status, server_default="RUNNING", nullable=False),
        sa.Column("triggered_by", sa.String(length=32), server_default="SCHEDULER", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_processed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("records_inserted", sa.Integer(), server_default="0", nullable=False),
        sa.Column("records_skipped", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_uuid"),
    )
    op.create_index("ix_ingestion_run_logs_job_name", "ingestion_run_logs", ["job_name"])

    op.create_table(
        "nav_ingestion_quarantine",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_log_id", sa.Integer(), nullable=False),
        sa.Column("raw_line", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["run_log_id"], ["ingestion_run_logs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    _seed_categories()


def _seed_categories() -> None:
    categories = [
        ("equity-funds", "Equity Funds"),
        ("debt-funds", "Debt Funds"),
        ("hybrid-funds", "Hybrid Funds"),
        ("elss-tax-saving", "ELSS / Tax Saving"),
        ("index-funds", "Index Funds"),
        ("liquid-funds", "Liquid Funds"),
    ]
    for slug, name in categories:
        op.execute(
            sa.text("INSERT INTO categories (slug, name) VALUES (:slug, :name) ON CONFLICT (slug) DO NOTHING").bindparams(
                slug=slug, name=name
            )
        )


def downgrade() -> None:
    op.drop_table("nav_ingestion_quarantine")
    op.drop_index("ix_ingestion_run_logs_job_name", table_name="ingestion_run_logs")
    op.drop_table("ingestion_run_logs")
    op.drop_table("product_categories")
    op.drop_table("scheme_navs")
    op.drop_index("ix_mutual_funds_scheme_code", table_name="mutual_funds")
    op.drop_table("mutual_funds")
    op.drop_table("categories")
    op.drop_table("products")
    op.drop_table("fund_amcs")
    ingestion_status.drop(op.get_bind(), checkfirst=True)
    product_lifecycle.drop(op.get_bind(), checkfirst=True)
    product_type.drop(op.get_bind(), checkfirst=True)
