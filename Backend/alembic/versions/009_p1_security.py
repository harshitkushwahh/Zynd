"""Revision ID: 009_p1_security
Revises: 008_p0_security
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_p1_security"
down_revision: Union[str, None] = "008_p0_security"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userstatus ADD VALUE IF NOT EXISTS 'suspended'")
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("suspension_reason_code", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("suspended_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_suspended_by",
        "users",
        "users",
        ["suspended_by"],
        ["id"],
        ondelete="SET NULL",
    )
    for value in ("mfa_disabled", "account_suspended", "account_unsuspended"):
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_constraint("fk_users_suspended_by", "users", type_="foreignkey")
    op.drop_column("users", "suspended_by")
    op.drop_column("users", "suspension_reason_code")
    op.drop_column("users", "suspended_at")
