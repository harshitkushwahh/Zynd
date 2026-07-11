"""Revision ID: 005_sprint3_security_review
Revises: 004_phase3_security
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_sprint3_security_review"
down_revision: Union[str, None] = "004_phase3_security"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

security_review_status = postgresql.ENUM(
    "open",
    "reviewed",
    "dismissed",
    name="securityreviewstatus",
    create_type=False,
)
security_review_reason = postgresql.ENUM(
    "new_device_login",
    "login_velocity_flagged",
    name="securityreviewreason",
    create_type=False,
)


def upgrade() -> None:
    security_review_status.create(op.get_bind(), checkfirst=True)
    security_review_reason.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "security_review_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("reason", security_review_reason, nullable=False),
        sa.Column("status", security_review_status, nullable=False, server_default="open"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("reviewer_id", sa.UUID(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_security_review_items_user_id", "security_review_items", ["user_id"])
    op.create_index("ix_security_review_items_reason", "security_review_items", ["reason"])
    op.create_index("ix_security_review_items_status", "security_review_items", ["status"])
    op.create_index("ix_security_review_items_created_at", "security_review_items", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_security_review_items_created_at", table_name="security_review_items")
    op.drop_index("ix_security_review_items_status", table_name="security_review_items")
    op.drop_index("ix_security_review_items_reason", table_name="security_review_items")
    op.drop_index("ix_security_review_items_user_id", table_name="security_review_items")
    op.drop_table("security_review_items")
    security_review_reason.drop(op.get_bind(), checkfirst=True)
    security_review_status.drop(op.get_bind(), checkfirst=True)
