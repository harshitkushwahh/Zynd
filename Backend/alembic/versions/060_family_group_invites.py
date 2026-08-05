"""Family group invites — Phase 1.

Revision ID: 060_family_group_invites
Revises: 059_family_groups_foundation
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "060_family_group_invites"
down_revision: Union[str, None] = "059_family_groups_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

family_group_invite_status = postgresql.ENUM(
    "pending",
    "accepted",
    "declined",
    "revoked",
    "expired",
    name="familygroupinvitestatus",
    create_type=False,
)

_INVITE_AUDIT_EVENTS = (
    "family_group_invite_sent",
    "family_group_invite_accepted",
    "family_group_invite_declined",
    "family_group_invite_revoked",
)


def upgrade() -> None:
    bind = op.get_bind()
    family_group_invite_status.create(bind, checkfirst=True)

    op.execute("ALTER TYPE notificationcategory ADD VALUE IF NOT EXISTS 'family'")

    for value in _INVITE_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("family_group_members", sa.Column("badge_key", sa.String(length=32), nullable=True))
    op.add_column("family_group_members", sa.Column("badge_label", sa.String(length=64), nullable=True))
    op.add_column("family_group_members", sa.Column("invited_by_user_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_family_group_members_invited_by_user_id",
        "family_group_members",
        "users",
        ["invited_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "family_group_invites",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("invitee_email", sa.String(length=254), nullable=True),
        sa.Column("invitee_user_id", sa.UUID(), nullable=True),
        sa.Column(
            "intended_role",
            postgresql.ENUM(
                "head",
                "contributor",
                "viewer",
                name="familygroupmemberrole",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("intended_badge_key", sa.String(length=32), nullable=True),
        sa.Column("intended_badge_label", sa.String(length=64), nullable=True),
        sa.Column("invited_by_user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            family_group_invite_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_user_id", sa.UUID(), nullable=True),
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
        sa.ForeignKeyConstraint(["accepted_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["group_id"], ["family_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invitee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_family_group_invites_group_id", "family_group_invites", ["group_id"])
    op.create_index("ix_family_group_invites_invitee_email", "family_group_invites", ["invitee_email"])
    op.create_index("ix_family_group_invites_invitee_user_id", "family_group_invites", ["invitee_user_id"])
    op.create_index("ix_family_group_invites_status", "family_group_invites", ["status"])
    op.create_index(
        "ix_family_group_invites_group_pending",
        "family_group_invites",
        ["group_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_family_group_invites_group_pending", table_name="family_group_invites")
    op.drop_index("ix_family_group_invites_status", table_name="family_group_invites")
    op.drop_index("ix_family_group_invites_invitee_user_id", table_name="family_group_invites")
    op.drop_index("ix_family_group_invites_invitee_email", table_name="family_group_invites")
    op.drop_index("ix_family_group_invites_group_id", table_name="family_group_invites")
    op.drop_table("family_group_invites")

    op.drop_constraint("fk_family_group_members_invited_by_user_id", "family_group_members", type_="foreignkey")
    op.drop_column("family_group_members", "invited_by_user_id")
    op.drop_column("family_group_members", "badge_label")
    op.drop_column("family_group_members", "badge_key")

    bind = op.get_bind()
    family_group_invite_status.drop(bind, checkfirst=True)
