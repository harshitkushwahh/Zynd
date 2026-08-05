"""Family groups foundation — Phase 0.

Revision ID: 059_family_groups_foundation
Revises: 058_risk_answer_snapshots
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "059_family_groups_foundation"
down_revision: Union[str, None] = "058_risk_answer_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

family_group_status = postgresql.ENUM(
    "active",
    "archived",
    name="familygroupstatus",
    create_type=False,
)

family_group_member_role = postgresql.ENUM(
    "head",
    "contributor",
    "viewer",
    name="familygroupmemberrole",
    create_type=False,
)

family_group_member_status = postgresql.ENUM(
    "active",
    "removed",
    name="familygroupmemberstatus",
    create_type=False,
)

_FAMILY_AUDIT_EVENTS = (
    "family_group_created",
    "family_group_updated",
    "family_group_archived",
)


def upgrade() -> None:
    bind = op.get_bind()
    family_group_status.create(bind, checkfirst=True)
    family_group_member_role.create(bind, checkfirst=True)
    family_group_member_status.create(bind, checkfirst=True)

    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'family_group_avatar'")

    for value in _FAMILY_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "family_groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tag", sa.String(length=32), nullable=True),
        sa.Column("avatar_document_id", sa.UUID(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            family_group_status,
            nullable=False,
            server_default="active",
        ),
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
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["avatar_document_id"], ["user_documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_family_groups_creator_active",
        "family_groups",
        ["created_by_user_id", "status"],
    )

    op.create_table(
        "family_group_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", family_group_member_role, nullable=False),
        sa.Column(
            "status",
            family_group_member_status,
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["family_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "user_id", name="uq_family_group_member"),
    )
    op.create_index("ix_family_group_members_group_id", "family_group_members", ["group_id"])
    op.create_index("ix_family_group_members_user_id", "family_group_members", ["user_id"])
    op.create_index(
        "ix_family_group_members_group_active",
        "family_group_members",
        ["group_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_family_group_members_group_active", table_name="family_group_members")
    op.drop_index("ix_family_group_members_user_id", table_name="family_group_members")
    op.drop_index("ix_family_group_members_group_id", table_name="family_group_members")
    op.drop_table("family_group_members")
    op.drop_index("ix_family_groups_creator_active", table_name="family_groups")
    op.drop_table("family_groups")

    bind = op.get_bind()
    family_group_member_status.drop(bind, checkfirst=True)
    family_group_member_role.drop(bind, checkfirst=True)
    family_group_status.drop(bind, checkfirst=True)
