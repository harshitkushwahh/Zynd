"""KYC nominee → family group bridge — Phase 4.

Revision ID: 063_family_group_kyc_bridge
Revises: 062_family_group_engagement
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "063_family_group_kyc_bridge"
down_revision: Union[str, None] = "062_family_group_engagement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

family_group_nominee_link_status = postgresql.ENUM(
    "skipped",
    "invited",
    "already_member",
    name="familygroupnomineelinkstatus",
    create_type=False,
)

_AUDIT_EVENTS = (
    "family_group_nominee_kyc_invited",
    "family_group_nominee_kyc_skipped",
)


def upgrade() -> None:
    bind = op.get_bind()
    family_group_nominee_link_status.create(bind, checkfirst=True)
    op.execute(
        "ALTER TYPE familygroupactivitytype ADD VALUE IF NOT EXISTS 'nominee.suggested_from_kyc'"
    )
    for value in _AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "family_group_nominee_links",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=True),
        sa.Column("kyc_nominee_id", sa.String(length=64), nullable=False),
        sa.Column("nominee_email", sa.String(length=254), nullable=False),
        sa.Column("nominee_name", sa.String(length=128), nullable=False),
        sa.Column("relationship", sa.String(length=32), nullable=False),
        sa.Column("status", family_group_nominee_link_status, nullable=False),
        sa.Column("invite_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["family_groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invite_id"], ["family_group_invites.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "kyc_nominee_id", name="uq_family_group_nominee_link"),
    )
    op.create_index("ix_family_group_nominee_links_user_id", "family_group_nominee_links", ["user_id"])
    op.create_index("ix_family_group_nominee_links_nominee_email", "family_group_nominee_links", ["nominee_email"])
    op.create_index("ix_family_group_nominee_links_status", "family_group_nominee_links", ["status"])


def downgrade() -> None:
    op.drop_index("ix_family_group_nominee_links_status", table_name="family_group_nominee_links")
    op.drop_index("ix_family_group_nominee_links_nominee_email", table_name="family_group_nominee_links")
    op.drop_index("ix_family_group_nominee_links_user_id", table_name="family_group_nominee_links")
    op.drop_table("family_group_nominee_links")
    family_group_nominee_link_status.drop(op.get_bind(), checkfirst=True)
