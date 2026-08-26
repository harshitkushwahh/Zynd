"""Distributor work attendance, leave, payroll, and promotions.

Revision ID: 085_distributor_work_payroll
Revises: 084_distributor_client_links
Create Date: 2026-08-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "085_distributor_work_payroll"
down_revision: Union[str, None] = "084_distributor_client_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

work_session_status = postgresql.ENUM(
    "active",
    "complete",
    name="distributorworksessionstatus",
    create_type=False,
)
leave_request_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    name="distributorleaverequeststatus",
    create_type=False,
)
salary_payment_status = postgresql.ENUM(
    "waiting",
    "done",
    "partial",
    "failed",
    name="distributorsalarypaymentstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    work_session_status.create(bind, checkfirst=True)
    leave_request_status.create(bind, checkfirst=True)
    salary_payment_status.create(bind, checkfirst=True)

    op.create_table(
        "distributor_work_configs",
        sa.Column("branch_id", sa.String(length=32), primary_key=True, nullable=False),
        sa.Column("config_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["branch_id"], ["distributor_branches.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "distributor_work_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("mitra_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", sa.String(length=32), nullable=True),
        sa.Column("signed_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signed_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("work_site_id", sa.String(length=32), nullable=False),
        sa.Column("work_mode_id", sa.String(length=32), nullable=False),
        sa.Column("time_slot_id", sa.String(length=64), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("geolocation_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "status",
            work_session_status,
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["branch_id"], ["distributor_branches.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_distributor_work_sessions_mitra_user_id",
        "distributor_work_sessions",
        ["mitra_user_id"],
    )
    op.create_index(
        "ix_distributor_work_sessions_branch_id",
        "distributor_work_sessions",
        ["branch_id"],
    )
    op.create_index(
        "ix_distributor_work_sessions_status",
        "distributor_work_sessions",
        ["status"],
    )

    op.create_table(
        "distributor_leave_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("mitra_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", sa.String(length=32), nullable=True),
        sa.Column("leave_type", sa.String(length=32), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(5, 1), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            leave_request_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "applied_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["branch_id"], ["distributor_branches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_distributor_leave_requests_mitra_user_id",
        "distributor_leave_requests",
        ["mitra_user_id"],
    )
    op.create_index(
        "ix_distributor_leave_requests_branch_id",
        "distributor_leave_requests",
        ["branch_id"],
    )
    op.create_index(
        "ix_distributor_leave_requests_status",
        "distributor_leave_requests",
        ["status"],
    )

    op.create_table(
        "distributor_partner_promotions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("mitra_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("previous_base_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("new_base_salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("hike_pct", sa.Numeric(6, 2), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_distributor_partner_promotions_mitra_user_id",
        "distributor_partner_promotions",
        ["mitra_user_id"],
    )

    op.create_table(
        "distributor_payroll_periods",
        sa.Column("id", sa.String(length=32), primary_key=True, nullable=False),
        sa.Column("mitra_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_label", sa.String(length=64), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("basic_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("performance_incentive", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("spot_bonus", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("take_home", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column(
            "payment_status",
            salary_payment_status,
            nullable=False,
            server_default="waiting",
        ),
        sa.Column("paid_on", sa.Date(), nullable=True),
        sa.Column("net_sales_target", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_sales_achieved", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("incentive_slab", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("calculated_incentive", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("adjustments", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("final_incentive", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_distributor_payroll_periods_mitra_user_id",
        "distributor_payroll_periods",
        ["mitra_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_distributor_payroll_periods_mitra_user_id", table_name="distributor_payroll_periods")
    op.drop_table("distributor_payroll_periods")
    op.drop_index("ix_distributor_partner_promotions_mitra_user_id", table_name="distributor_partner_promotions")
    op.drop_table("distributor_partner_promotions")
    op.drop_index("ix_distributor_leave_requests_status", table_name="distributor_leave_requests")
    op.drop_index("ix_distributor_leave_requests_branch_id", table_name="distributor_leave_requests")
    op.drop_index("ix_distributor_leave_requests_mitra_user_id", table_name="distributor_leave_requests")
    op.drop_table("distributor_leave_requests")
    op.drop_index("ix_distributor_work_sessions_status", table_name="distributor_work_sessions")
    op.drop_index("ix_distributor_work_sessions_branch_id", table_name="distributor_work_sessions")
    op.drop_index("ix_distributor_work_sessions_mitra_user_id", table_name="distributor_work_sessions")
    op.drop_table("distributor_work_sessions")
    op.drop_table("distributor_work_configs")

    bind = op.get_bind()
    salary_payment_status.drop(bind, checkfirst=True)
    leave_request_status.drop(bind, checkfirst=True)
    work_session_status.drop(bind, checkfirst=True)
