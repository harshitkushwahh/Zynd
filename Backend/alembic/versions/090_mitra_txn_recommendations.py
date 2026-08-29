"""Mitra quick-transaction recommendation links for investor cart prefill.

Revision ID: 090_mitra_txn_recommendations
Revises: 089_recommendation_rbac_permissions
Create Date: 2026-08-29
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "090_mitra_txn_recommendations"
down_revision: Union[str, None] = "089_recommendation_rbac_permissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

mitra_txn_recommendation_status = postgresql.ENUM(
    "sent",
    "opened",
    "invested",
    "expired",
    "cancelled",
    name="mitratxnrecommendationstatus",
    create_type=False,
)
mitra_txn_investment_type = postgresql.ENUM(
    "one_time",
    "sip",
    name="mitratxninvestmenttype",
    create_type=False,
)
mitra_txn_payment_method = postgresql.ENUM(
    "upi",
    "netbanking",
    name="mitratxnpaymentmethod",
    create_type=False,
)

PERMISSIONS: tuple[tuple[str, str], ...] = (
    (
        "distributor.txn_recommendations.create",
        "Send quick transaction recommendation links to book clients",
    ),
    (
        "distributor.txn_recommendations.read",
        "View quick transaction recommendations sent from the Mitra console",
    ),
)

MITRA_ROLE_KEYS = ("mitra", "mitra_manager")


def _insert_permission(key: str, description: str) -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO admin_permissions (id, key, description)
            SELECT gen_random_uuid(), :key, :description
            WHERE NOT EXISTS (
                SELECT 1 FROM admin_permissions WHERE key = :key
            )
            """
        ).bindparams(key=key, description=description),
    )


def _grant_role(permission_key: str, role_key: str) -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO admin_role_permissions (id, role_id, permission_id)
            SELECT gen_random_uuid(), r.id, p.id
            FROM admin_roles r
            CROSS JOIN admin_permissions p
            WHERE r.key = :role_key
              AND p.key = :permission_key
              AND NOT EXISTS (
                  SELECT 1
                  FROM admin_role_permissions arp
                  WHERE arp.role_id = r.id
                    AND arp.permission_id = p.id
              )
            """
        ).bindparams(role_key=role_key, permission_key=permission_key),
    )


def upgrade() -> None:
    bind = op.get_bind()
    mitra_txn_recommendation_status.create(bind, checkfirst=True)
    mitra_txn_investment_type.create(bind, checkfirst=True)
    mitra_txn_payment_method.create(bind, checkfirst=True)

    op.create_table(
        "mitra_txn_recommendations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("mitra_user_id", sa.UUID(), nullable=False),
        sa.Column("client_user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("investment_type", mitra_txn_investment_type, nullable=False),
        sa.Column("amount_inr", sa.Numeric(14, 2), nullable=False),
        sa.Column("number_of_installments", sa.Integer(), nullable=True),
        sa.Column("installment_day", sa.Integer(), nullable=True),
        sa.Column("sip_frequency", sa.String(length=32), server_default="monthly", nullable=False),
        sa.Column("payment_method", mitra_txn_payment_method, nullable=False),
        sa.Column(
            "status",
            mitra_txn_recommendation_status,
            server_default="sent",
            nullable=False,
        ),
        sa.Column("fund_name", sa.String(length=512), nullable=False),
        sa.Column("product_code", sa.String(length=64), nullable=True),
        sa.Column("fund_slug", sa.String(length=256), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["client_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_mitra_txn_recommendations_token"),
    )
    op.create_index(
        "ix_mitra_txn_recommendations_mitra_user_id",
        "mitra_txn_recommendations",
        ["mitra_user_id"],
    )
    op.create_index(
        "ix_mitra_txn_recommendations_client_user_id",
        "mitra_txn_recommendations",
        ["client_user_id"],
    )
    op.create_index(
        "ix_mitra_txn_recommendations_status",
        "mitra_txn_recommendations",
        ["status"],
    )
    op.create_index(
        "ix_mitra_txn_recommendations_expires_at",
        "mitra_txn_recommendations",
        ["expires_at"],
    )
    op.create_index(
        "ix_mitra_txn_recommendations_created_at",
        "mitra_txn_recommendations",
        ["created_at"],
    )

    for key, description in PERMISSIONS:
        _insert_permission(key, description)
        _grant_role(key, "super_admin")
        for role_key in MITRA_ROLE_KEYS:
            _grant_role(key, role_key)


def downgrade() -> None:
    permission_keys = [key for key, _ in PERMISSIONS]
    op.execute(
        sa.text(
            """
            DELETE FROM admin_role_permissions arp
            USING admin_permissions p
            WHERE arp.permission_id = p.id
              AND p.key = ANY(:permission_keys)
            """
        ).bindparams(permission_keys=permission_keys),
    )
    op.execute(
        sa.text("DELETE FROM admin_permissions WHERE key = ANY(:permission_keys)").bindparams(
            permission_keys=permission_keys,
        ),
    )
    op.drop_index("ix_mitra_txn_recommendations_created_at", table_name="mitra_txn_recommendations")
    op.drop_index("ix_mitra_txn_recommendations_expires_at", table_name="mitra_txn_recommendations")
    op.drop_index("ix_mitra_txn_recommendations_status", table_name="mitra_txn_recommendations")
    op.drop_index("ix_mitra_txn_recommendations_client_user_id", table_name="mitra_txn_recommendations")
    op.drop_index("ix_mitra_txn_recommendations_mitra_user_id", table_name="mitra_txn_recommendations")
    op.drop_table("mitra_txn_recommendations")
    mitra_txn_payment_method.drop(op.get_bind(), checkfirst=True)
    mitra_txn_investment_type.drop(op.get_bind(), checkfirst=True)
    mitra_txn_recommendation_status.drop(op.get_bind(), checkfirst=True)
