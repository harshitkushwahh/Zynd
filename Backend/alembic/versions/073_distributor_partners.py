"""Distributor partner onboarding records.

Revision ID: 073_distributor_partners
Revises: 072_mf_sip_cart_installments
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "073_distributor_partners"
down_revision: Union[str, None] = "072_mf_sip_cart_installments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

partner_status = postgresql.ENUM(
    "pending_password",
    "active",
    name="distributorpartnerstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    partner_status.create(bind, checkfirst=True)

    op.create_table(
        "distributor_partners",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("onboarded_by_user_id", sa.UUID(), nullable=True),
        sa.Column("pan_masked", sa.String(length=12), nullable=True),
        sa.Column("profile_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "status",
            partner_status,
            nullable=False,
            server_default="pending_password",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["onboarded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_distributor_partners_user_id", "distributor_partners", ["user_id"])
    op.create_index(
        "ix_distributor_partners_onboarded_by_user_id",
        "distributor_partners",
        ["onboarded_by_user_id"],
    )
    op.create_index("ix_distributor_partners_status", "distributor_partners", ["status"])


def downgrade() -> None:
    op.drop_index("ix_distributor_partners_status", table_name="distributor_partners")
    op.drop_index("ix_distributor_partners_onboarded_by_user_id", table_name="distributor_partners")
    op.drop_index("ix_distributor_partners_user_id", table_name="distributor_partners")
    op.drop_table("distributor_partners")
    partner_status.drop(op.get_bind(), checkfirst=True)
