"""Bot help feedback on support messages.

Revision ID: 112_support_bot_help_feedback
Revises: 111_kyc_nominee_update_consent
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "112_support_bot_help_feedback"
down_revision: Union[str, None] = "111_kyc_nominee_update_consent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "support_tickets",
        sa.Column("bot_unhelpful_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "support_bot_message_feedback",
        sa.Column("message_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("choice", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("choice IN ('yes', 'no')", name="ck_support_bot_message_feedback_choice"),
        sa.ForeignKeyConstraint(["message_id"], ["support_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("message_id"),
    )
    op.create_index(
        "ix_support_bot_message_feedback_user_id",
        "support_bot_message_feedback",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_support_bot_message_feedback_user_id", table_name="support_bot_message_feedback")
    op.drop_table("support_bot_message_feedback")
    op.drop_column("support_tickets", "bot_unhelpful_count")
