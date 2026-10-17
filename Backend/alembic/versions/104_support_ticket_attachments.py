"""Ticket images and the 24-hour resolution prompt.

Revision ID: 104_support_ticket_attachments
Revises: 103_support_help_bot
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "104_support_ticket_attachments"
down_revision: Union[str, None] = "103_support_help_bot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'support_attachment'")
    op.add_column(
        "support_messages",
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="text"),
    )
    op.add_column(
        "support_messages",
        sa.Column("attachment_document_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "support_messages",
        sa.Column("attachment_filename", sa.String(length=255), nullable=True),
    )
    op.create_check_constraint(
        "ck_support_messages_kind",
        "support_messages",
        "kind IN ('text', 'resolution_prompt')",
    )
    op.add_column(
        "support_tickets",
        sa.Column("resolution_prompted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "support_tickets",
        sa.Column("resolution_choice", sa.String(length=16), nullable=True),
    )
    op.create_check_constraint(
        "ck_support_tickets_resolution_choice",
        "support_tickets",
        "resolution_choice IS NULL OR resolution_choice IN ('yes', 'no', 'auto')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_support_tickets_resolution_choice", "support_tickets", type_="check")
    op.drop_column("support_tickets", "resolution_choice")
    op.drop_column("support_tickets", "resolution_prompted_at")
    op.drop_constraint("ck_support_messages_kind", "support_messages", type_="check")
    op.drop_column("support_messages", "attachment_filename")
    op.drop_column("support_messages", "attachment_document_id")
    op.drop_column("support_messages", "kind")
