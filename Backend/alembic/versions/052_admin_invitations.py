"""Admin invitation records for email magic-link onboarding.

Revision ID: 052_admin_invitations
Revises: 051_zynd_provider_logs
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "052_admin_invitations"
down_revision: Union[str, None] = "051_zynd_provider_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

admin_invitation_status = postgresql.ENUM(
    "pending",
    "accepted",
    "revoked",
    "expired",
    name="admininvitationstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    admin_invitation_status.create(bind, checkfirst=True)

    op.create_table(
        "admin_invitations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=True),
        sa.Column("last_name", sa.String(length=50), nullable=True),
        sa.Column("role_key", sa.String(length=64), nullable=False),
        sa.Column("status", admin_invitation_status, nullable=False, server_default="pending"),
        sa.Column("invited_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_invitations_email", "admin_invitations", ["email"])
    op.create_index("ix_admin_invitations_status", "admin_invitations", ["status"])
    op.create_index("ix_admin_invitations_expires_at", "admin_invitations", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_invitations_expires_at", table_name="admin_invitations")
    op.drop_index("ix_admin_invitations_status", table_name="admin_invitations")
    op.drop_index("ix_admin_invitations_email", table_name="admin_invitations")
    op.drop_table("admin_invitations")
    admin_invitation_status.drop(op.get_bind(), checkfirst=True)
