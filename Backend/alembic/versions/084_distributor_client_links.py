"""Distributor client book links keyed by Zynd Mitra code.

Revision ID: 084_distributor_client_links
Revises: 083_admin_account_removed_audit_event
Create Date: 2026-08-16
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "084_distributor_client_links"
down_revision: Union[str, None] = "083_admin_account_removed_audit_event"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "distributor_client_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mitra_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mitra_client_id", sa.String(length=128), nullable=False),
        sa.Column("branch_id", sa.String(length=32), nullable=True),
        sa.Column("onboarded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(["client_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mitra_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["onboarded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["branch_id"], ["distributor_branches.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("client_user_id", name="uq_distributor_client_links_client_user_id"),
    )
    op.create_index(
        "ix_distributor_client_links_mitra_user_id",
        "distributor_client_links",
        ["mitra_user_id"],
    )
    op.create_index(
        "ix_distributor_client_links_mitra_client_id",
        "distributor_client_links",
        ["mitra_client_id"],
    )
    op.create_index(
        "ix_distributor_client_links_branch_id",
        "distributor_client_links",
        ["branch_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_distributor_client_links_branch_id", table_name="distributor_client_links")
    op.drop_index("ix_distributor_client_links_mitra_client_id", table_name="distributor_client_links")
    op.drop_index("ix_distributor_client_links_mitra_user_id", table_name="distributor_client_links")
    op.drop_table("distributor_client_links")
