"""MF transactions — orders, MFIA, CAS imports.

Revision ID: 037_mf_transactions
Revises: 036_mf_analytics
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "037_mf_transactions"
down_revision: Union[str, None] = "036_mf_analytics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mf_investment_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("fp_mfia_id", sa.String(length=128), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACTIVE", "FAILED", name="mf_investment_account_status"),
            nullable=False,
        ),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_mfia_id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "mf_orders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("mf_investment_account_id", sa.UUID(), nullable=True),
        sa.Column(
            "order_type",
            sa.Enum("LUMPSUM", "SIP", "REDEMPTION", name="mf_order_type"),
            nullable=False,
        ),
        sa.Column("amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "SUBMITTED",
                "PAYMENT_PENDING",
                "PROCESSING",
                "SUCCEEDED",
                "FAILED",
                "CANCELLED",
                name="mf_order_status",
            ),
            nullable=False,
        ),
        sa.Column("fp_purchase_id", sa.String(length=128), nullable=True),
        sa.Column("fp_scheme_id", sa.String(length=128), nullable=True),
        sa.Column("fp_state", sa.String(length=64), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["mf_investment_account_id"], ["mf_investment_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_purchase_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mf_orders_user_id", "mf_orders", ["user_id"])
    op.create_index("ix_mf_orders_status", "mf_orders", ["status"])

    op.create_table(
        "mf_order_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["mf_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_order_events_order_id", "mf_order_events", ["order_id"])

    op.create_table(
        "mf_cas_imports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "SUCCEEDED", "FAILED", name="mf_cas_import_status"),
            nullable=False,
        ),
        sa.Column("external_request_id", sa.String(length=128), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("holdings_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_cas_imports_user_id", "mf_cas_imports", ["user_id"])
    op.create_index("ix_mf_cas_imports_status", "mf_cas_imports", ["status"])

    op.create_table(
        "mf_external_holdings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("cas_import_id", sa.UUID(), nullable=True),
        sa.Column("isin", sa.String(length=24), nullable=False),
        sa.Column("scheme_name", sa.String(length=512), nullable=False),
        sa.Column("folio_number", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("units", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("nav_value", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("market_value_inr", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("amc_name", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="MF_CENTRAL"),
        sa.Column("matched_fund_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cas_import_id"], ["mf_cas_imports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["matched_fund_id"], ["mutual_funds.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "isin", "folio_number", name="uq_mf_external_holdings"),
    )
    op.create_index("ix_mf_external_holdings_user_id", "mf_external_holdings", ["user_id"])


def downgrade() -> None:
    op.drop_table("mf_external_holdings")
    op.drop_table("mf_cas_imports")
    op.drop_table("mf_order_events")
    op.drop_table("mf_orders")
    op.drop_table("mf_investment_accounts")
    op.execute("DROP TYPE IF EXISTS mf_cas_import_status")
    op.execute("DROP TYPE IF EXISTS mf_order_status")
    op.execute("DROP TYPE IF EXISTS mf_order_type")
    op.execute("DROP TYPE IF EXISTS mf_investment_account_status")
