"""Phase 2 push devices — FCM token registry for mobile/web push.

Revision ID: 033_push_devices
Revises: 032_notifications
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "033_push_devices"
down_revision: Union[str, None] = "032_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

push_platform = postgresql.ENUM(
    "ios",
    "android",
    "web",
    name="pushplatform",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    push_platform.create(bind, checkfirst=True)

    op.create_table(
        "user_push_devices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("platform", push_platform, nullable=False),
        sa.Column("fcm_token", sa.String(length=512), nullable=False),
        sa.Column("device_label", sa.String(length=120), nullable=True),
        sa.Column("app_version", sa.String(length=32), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fcm_token", name="uq_user_push_devices_fcm_token"),
    )
    op.create_index("ix_user_push_devices_user_id", "user_push_devices", ["user_id"])
    op.create_index(
        "ix_user_push_devices_user_active",
        "user_push_devices",
        ["user_id", "revoked_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_push_devices_user_active", table_name="user_push_devices")
    op.drop_index("ix_user_push_devices_user_id", table_name="user_push_devices")
    op.drop_table("user_push_devices")
    push_platform.drop(op.get_bind(), checkfirst=True)
