"""Extend distributor partners for HO review and ARN provisioning.

Revision ID: 074_dist_partner_ho_review
Revises: 073_distributor_partners
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "074_dist_partner_ho_review"
down_revision: Union[str, None] = "073_distributor_partners"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _foreign_key_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {constraint["name"] for constraint in inspector.get_foreign_keys(table_name)}


def upgrade() -> None:
    op.execute("ALTER TYPE distributorpartnerstatus ADD VALUE IF NOT EXISTS 'pending_ho_review'")
    op.execute("ALTER TYPE distributorpartnerstatus ADD VALUE IF NOT EXISTS 'rejected'")

    columns = _column_names("distributor_partners")
    if "arn" not in columns:
        op.add_column("distributor_partners", sa.Column("arn", sa.String(length=32), nullable=True))
    if "euin" not in columns:
        op.add_column("distributor_partners", sa.Column("euin", sa.String(length=32), nullable=True))
    if "ho_reviewed_by_user_id" not in columns:
        op.add_column(
            "distributor_partners",
            sa.Column("ho_reviewed_by_user_id", sa.UUID(), nullable=True),
        )
    if "ho_reviewed_at" not in columns:
        op.add_column(
            "distributor_partners",
            sa.Column("ho_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "ho_rejection_reason" not in columns:
        op.add_column(
            "distributor_partners",
            sa.Column("ho_rejection_reason", sa.String(length=512), nullable=True),
        )

    foreign_keys = _foreign_key_names("distributor_partners")
    if "fk_distributor_partners_ho_reviewed_by_user_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_distributor_partners_ho_reviewed_by_user_id",
            "distributor_partners",
            "users",
            ["ho_reviewed_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    indexes = _index_names("distributor_partners")
    if "ix_distributor_partners_arn" not in indexes:
        op.create_index("ix_distributor_partners_arn", "distributor_partners", ["arn"], unique=False)


def downgrade() -> None:
    indexes = _index_names("distributor_partners")
    if "ix_distributor_partners_arn" in indexes:
        op.drop_index("ix_distributor_partners_arn", table_name="distributor_partners")

    foreign_keys = _foreign_key_names("distributor_partners")
    if "fk_distributor_partners_ho_reviewed_by_user_id" in foreign_keys:
        op.drop_constraint(
            "fk_distributor_partners_ho_reviewed_by_user_id",
            "distributor_partners",
            type_="foreignkey",
        )

    columns = _column_names("distributor_partners")
    for column_name in (
        "ho_rejection_reason",
        "ho_reviewed_at",
        "ho_reviewed_by_user_id",
        "euin",
        "arn",
    ):
        if column_name in columns:
            op.drop_column("distributor_partners", column_name)
