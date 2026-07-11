"""Revision ID: 010_p2_p3_security
Revises: 009_p1_security
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010_p2_p3_security"
down_revision: Union[str, None] = "009_p1_security"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

admin_action_type = postgresql.ENUM(
    "account_suspend",
    "account_unsuspend",
    "encryption_rotate_mfa",
    "deletion_executor_run",
    "security_config_update",
    name="adminactiontype",
    create_type=False,
)
admin_action_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    "expired",
    name="adminactionstatus",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        "CREATE TYPE adminactiontype AS ENUM ("
        "'account_suspend', 'account_unsuspend', 'encryption_rotate_mfa', "
        "'deletion_executor_run', 'security_config_update')"
    )
    op.execute(
        "CREATE TYPE adminactionstatus AS ENUM ('pending', 'approved', 'rejected', 'expired')"
    )

    op.create_table(
        "admin_action_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action_type", admin_action_type, nullable=False),
        sa.Column("status", admin_action_status, nullable=False, server_default="pending"),
        sa.Column("target_type", sa.String(length=64), nullable=True),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rejection_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_admin_action_requests_action_type", "admin_action_requests", ["action_type"])
    op.create_index("ix_admin_action_requests_status", "admin_action_requests", ["status"])
    op.create_index("ix_admin_action_requests_target_id", "admin_action_requests", ["target_id"])
    op.create_index("ix_admin_action_requests_requested_by", "admin_action_requests", ["requested_by"])
    op.create_index("ix_admin_action_requests_created_at", "admin_action_requests", ["created_at"])

    op.create_table(
        "login_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("failure_reason", sa.String(length=64), nullable=True),
        sa.Column("captcha_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_login_attempts_email", "login_attempts", ["email"])
    op.create_index("ix_login_attempts_user_id", "login_attempts", ["user_id"])
    op.create_index("ix_login_attempts_ip_address", "login_attempts", ["ip_address"])
    op.create_index("ix_login_attempts_created_at", "login_attempts", ["created_at"])

    op.create_table(
        "security_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False, server_default="global"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_security_config_key", "security_config", ["key"])

    op.create_table(
        "security_config_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("config_key", sa.String(length=128), nullable=False),
        sa.Column("old_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_security_config_history_config_key", "security_config_history", ["config_key"])
    op.create_index("ix_security_config_history_created_at", "security_config_history", ["created_at"])

    op.create_table(
        "webauthn_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credential_id", sa.String(length=512), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("device_name", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("credential_id", name="uq_webauthn_credential_id"),
    )
    op.create_index("ix_webauthn_credentials_user_id", "webauthn_credentials", ["user_id"])

    for value in (
        "admin_action_requested",
        "admin_action_approved",
        "admin_action_rejected",
        "login_ip_blocked",
        "adaptive_auth_blocked",
    ):
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_table("webauthn_credentials")
    op.drop_table("security_config_history")
    op.drop_table("security_config")
    op.drop_table("login_attempts")
    op.drop_table("admin_action_requests")
    op.execute("DROP TYPE IF EXISTS adminactionstatus")
    op.execute("DROP TYPE IF EXISTS adminactiontype")
