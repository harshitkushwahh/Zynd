"""Phase 1 notifications — in-app inbox and user preferences.

Revision ID: 032_notifications
Revises: 031_referral_stage5
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "032_notifications"
down_revision: Union[str, None] = "031_referral_stage5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notification_category = postgresql.ENUM(
    "security",
    "kyc",
    "referral",
    "account",
    name="notificationcategory",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    notification_category.create(bind, checkfirst=True)

    op.create_table(
        "user_notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "category",
            notification_category,
            nullable=False,
        ),
        sa.Column("notification_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_user_notifications_idempotency"),
    )
    op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"])
    op.create_index("ix_user_notifications_category", "user_notifications", ["category"])
    op.create_index("ix_user_notifications_notification_type", "user_notifications", ["notification_type"])
    op.create_index("ix_user_notifications_created_at", "user_notifications", ["created_at"])
    op.create_index(
        "ix_user_notifications_user_unread",
        "user_notifications",
        ["user_id", "read_at"],
    )

    op.create_table(
        "user_notification_preferences",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "category",
            notification_category,
            nullable=False,
        ),
        sa.Column("email_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "category"),
    )


def downgrade() -> None:
    op.drop_table("user_notification_preferences")
    op.drop_index("ix_user_notifications_user_unread", table_name="user_notifications")
    op.drop_index("ix_user_notifications_created_at", table_name="user_notifications")
    op.drop_index("ix_user_notifications_notification_type", table_name="user_notifications")
    op.drop_index("ix_user_notifications_category", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id", table_name="user_notifications")
    op.drop_table("user_notifications")
    notification_category.drop(op.get_bind(), checkfirst=True)
