"""MF payment foundation — checkouts, cart, webhook events, order linkage.

Revision ID: 047_mf_payment_foundation
Revises: 046_mf_collections
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "047_mf_payment_foundation"
down_revision: Union[str, None] = "046_mf_collections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mf_investment_accounts", sa.Column("fp_mfia_old_id", sa.Integer(), nullable=True))

    op.create_table(
        "mf_checkouts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "checkout_type",
            sa.Enum("SINGLE", "CART", name="mf_checkout_type"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "PAYMENT_PENDING",
                "SUBMITTED",
                "PROCESSING",
                "SUCCEEDED",
                "FAILED",
                "CANCELLED",
                name="mf_checkout_status",
            ),
            nullable=False,
        ),
        sa.Column("total_amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("fp_payment_id", sa.Integer(), nullable=True),
        sa.Column("token_url", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mf_checkouts_user_id", "mf_checkouts", ["user_id"])
    op.create_index("ix_mf_checkouts_status", "mf_checkouts", ["status"])

    op.create_table(
        "mf_cart_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("fp_scheme_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", name="uq_mf_cart_items_user_product"),
    )
    op.create_index("ix_mf_cart_items_user_id", "mf_cart_items", ["user_id"])

    op.add_column("mf_orders", sa.Column("checkout_id", sa.UUID(), nullable=True))
    op.add_column("mf_orders", sa.Column("fp_purchase_old_id", sa.Integer(), nullable=True))
    op.add_column("mf_orders", sa.Column("line_index", sa.Integer(), nullable=False, server_default="0"))
    op.create_foreign_key(
        "fk_mf_orders_checkout_id",
        "mf_orders",
        "mf_checkouts",
        ["checkout_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_mf_orders_checkout_id", "mf_orders", ["checkout_id"])

    op.create_table(
        "mf_finprim_webhook_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fp_event_id", sa.String(length=128), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "processing_status",
            sa.Enum("RECEIVED", "PROCESSED", "IGNORED", "FAILED", name="mf_webhook_processing_status"),
            nullable=False,
        ),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_event_id"),
    )
    op.create_index("ix_mf_finprim_webhook_events_event_type", "mf_finprim_webhook_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("mf_finprim_webhook_events")
    op.execute("DROP TYPE IF EXISTS mf_webhook_processing_status")

    op.drop_index("ix_mf_orders_checkout_id", table_name="mf_orders")
    op.drop_constraint("fk_mf_orders_checkout_id", "mf_orders", type_="foreignkey")
    op.drop_column("mf_orders", "line_index")
    op.drop_column("mf_orders", "fp_purchase_old_id")
    op.drop_column("mf_orders", "checkout_id")

    op.drop_table("mf_cart_items")
    op.drop_table("mf_checkouts")
    op.execute("DROP TYPE IF EXISTS mf_checkout_status")
    op.execute("DROP TYPE IF EXISTS mf_checkout_type")

    op.drop_column("mf_investment_accounts", "fp_mfia_old_id")
