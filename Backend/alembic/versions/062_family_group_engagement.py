"""Family group engagement — Phase 3.

Revision ID: 062_family_group_engagement
Revises: 061_family_group_governance
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "062_family_group_engagement"
down_revision: Union[str, None] = "061_family_group_governance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

family_group_activity_type = postgresql.ENUM(
    "member.joined",
    "member.left",
    "member.removed",
    "role.changed",
    "badge.changed",
    "nickname.changed",
    "invite.sent",
    "invite.accepted",
    "invite.declined",
    "invite.revoked",
    "group.updated",
    "group.archived",
    "head.transferred",
    name="familygroupactivitytype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    family_group_activity_type.create(bind, checkfirst=True)

    op.add_column(
        "family_group_members",
        sa.Column("display_nickname", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "family_group_members",
        sa.Column("nickname_set_by_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_family_group_members_nickname_set_by_user_id",
        "family_group_members",
        "users",
        ["nickname_set_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "family_group_invites",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "family_group_invites",
        sa.Column("reminder_count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "family_group_activities",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("event_type", family_group_activity_type, nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("target_user_id", sa.UUID(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["group_id"], ["family_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_family_group_activities_group_id", "family_group_activities", ["group_id"])
    op.create_index("ix_family_group_activities_event_type", "family_group_activities", ["event_type"])
    op.create_index("ix_family_group_activities_created_at", "family_group_activities", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_family_group_activities_created_at", table_name="family_group_activities")
    op.drop_index("ix_family_group_activities_event_type", table_name="family_group_activities")
    op.drop_index("ix_family_group_activities_group_id", table_name="family_group_activities")
    op.drop_table("family_group_activities")
    op.drop_column("family_group_invites", "reminder_count")
    op.drop_column("family_group_invites", "reminder_sent_at")
    op.drop_constraint(
        "fk_family_group_members_nickname_set_by_user_id",
        "family_group_members",
        type_="foreignkey",
    )
    op.drop_column("family_group_members", "nickname_set_by_user_id")
    op.drop_column("family_group_members", "display_nickname")
    family_group_activity_type.drop(op.get_bind(), checkfirst=True)
