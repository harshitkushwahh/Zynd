"""MF switch orders plus SWP/STP plan tables.

Revision ID: 098_mf_switch_swp_stp
Revises: 097_kyc_partner_external_refs
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "098_mf_switch_swp_stp"
down_revision: Union[str, None] = "097_kyc_partner_external_refs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE mf_order_type ADD VALUE IF NOT EXISTS 'SWITCH'")

    plan_status = postgresql.ENUM(
        "PENDING",
        "REVIEW",
        "CONSENT_PENDING",
        "ACTIVE",
        "CANCELLED",
        "FAILED",
        name="mf_sip_plan_status",
        create_type=False,
    )

    op.create_table(
        "mf_swp_plans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("mf_investment_account_id", sa.UUID(), nullable=True),
        sa.Column("amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("installment_day", sa.Integer(), nullable=True),
        sa.Column("number_of_installments", sa.Integer(), nullable=False),
        sa.Column("folio_number", sa.String(length=64), nullable=True),
        sa.Column("status", plan_status, nullable=False),
        sa.Column("fp_plan_id", sa.String(length=128), nullable=True),
        sa.Column("fp_state", sa.String(length=64), nullable=True),
        sa.Column("next_installment_date", sa.Date(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["mf_investment_account_id"], ["mf_investment_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_plan_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mf_swp_plans_user_id", "mf_swp_plans", ["user_id"])
    op.create_index("ix_mf_swp_plans_status", "mf_swp_plans", ["status"])

    op.create_table(
        "mf_swp_plan_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="SYSTEM"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["mf_swp_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_swp_plan_events_plan_id", "mf_swp_plan_events", ["plan_id"])

    op.create_table(
        "mf_stp_plans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("fund_id", sa.Integer(), nullable=False),
        sa.Column("switch_in_fund_id", sa.Integer(), nullable=False),
        sa.Column("switch_in_product_id", sa.UUID(), nullable=False),
        sa.Column("mf_investment_account_id", sa.UUID(), nullable=True),
        sa.Column("amount_inr", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("installment_day", sa.Integer(), nullable=True),
        sa.Column("number_of_installments", sa.Integer(), nullable=False),
        sa.Column("folio_number", sa.String(length=64), nullable=True),
        sa.Column("status", plan_status, nullable=False),
        sa.Column("fp_plan_id", sa.String(length=128), nullable=True),
        sa.Column("fp_state", sa.String(length=64), nullable=True),
        sa.Column("next_installment_date", sa.Date(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["fund_id"], ["mutual_funds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["switch_in_fund_id"], ["mutual_funds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["mf_investment_account_id"], ["mf_investment_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["switch_in_product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fp_plan_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_mf_stp_plans_user_id", "mf_stp_plans", ["user_id"])
    op.create_index("ix_mf_stp_plans_status", "mf_stp_plans", ["status"])

    op.create_table(
        "mf_stp_plan_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="SYSTEM"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["mf_stp_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_stp_plan_events_plan_id", "mf_stp_plan_events", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_mf_stp_plan_events_plan_id", table_name="mf_stp_plan_events")
    op.drop_table("mf_stp_plan_events")
    op.drop_index("ix_mf_stp_plans_status", table_name="mf_stp_plans")
    op.drop_index("ix_mf_stp_plans_user_id", table_name="mf_stp_plans")
    op.drop_table("mf_stp_plans")
    op.drop_index("ix_mf_swp_plan_events_plan_id", table_name="mf_swp_plan_events")
    op.drop_table("mf_swp_plan_events")
    op.drop_index("ix_mf_swp_plans_status", table_name="mf_swp_plans")
    op.drop_index("ix_mf_swp_plans_user_id", table_name="mf_swp_plans")
    op.drop_table("mf_swp_plans")
