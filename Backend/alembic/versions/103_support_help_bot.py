"""Support conversations, tickets, and resolution examples for Zynd Help Bot.

Revision ID: 103_support_help_bot
Revises: 102_mf_transaction_consent
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "103_support_help_bot"
down_revision: Union[str, None] = "102_mf_transaction_consent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS support_ticket_public_seq START 1000")

    op.create_table(
        "support_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("handler", sa.String(length=16), nullable=False, server_default="bot"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('open', 'escalated', 'closed')",
            name="ck_support_conversations_status",
        ),
        sa.CheckConstraint(
            "handler IN ('bot', 'human')",
            name="ck_support_conversations_handler",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_conversations_user_id", "support_conversations", ["user_id"])
    op.create_index(
        "uq_support_conversations_active_user",
        "support_conversations",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'closed'"),
    )

    op.create_table(
        "support_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="customer"),
        sa.Column("sender_name", sa.String(length=80), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('user', 'bot', 'agent', 'system')",
            name="ck_support_messages_role",
        ),
        sa.CheckConstraint(
            "visibility IN ('customer', 'internal')",
            name="ck_support_messages_visibility",
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["conversation_id"], ["support_conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_messages_conversation_id", "support_messages", ["conversation_id"])
    op.create_index("ix_support_messages_created_at", "support_messages", ["created_at"])

    op.create_table(
        "support_tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("public_id", sa.String(length=32), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("topic", sa.String(length=32), nullable=False, server_default="other"),
        sa.Column("topics", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("channel", sa.String(length=16), nullable=False, server_default="web_chat"),
        sa.Column("handled_by", sa.String(length=16), nullable=False, server_default="bot"),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("escalation_reason", sa.Text(), nullable=True),
        sa.Column("first_response_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('open', 'pending', 'resolved')", name="ck_support_tickets_status"),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_support_tickets_priority"),
        sa.CheckConstraint(
            "topic IN ('kyc', 'payment', 'family', 'goals', 'portfolio', 'account', 'referrals', 'other')",
            name="ck_support_tickets_topic",
        ),
        sa.CheckConstraint("handled_by IN ('bot', 'human')", name="ck_support_tickets_handled_by"),
        sa.CheckConstraint("channel IN ('web_chat', 'email')", name="ck_support_tickets_channel"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["conversation_id"], ["support_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id"),
        sa.UniqueConstraint("conversation_id"),
    )
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])
    op.create_index("ix_support_tickets_status", "support_tickets", ["status"])
    op.create_index("ix_support_tickets_topic", "support_tickets", ["topic"])
    op.create_index("ix_support_tickets_handled_by", "support_tickets", ["handled_by"])

    op.create_table(
        "support_resolution_examples",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic", sa.String(length=32), nullable=False, server_default="other"),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(
                "to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, ''))",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_resolution_examples_ticket_id", "support_resolution_examples", ["ticket_id"])
    op.create_index(
        "ix_support_resolution_examples_search",
        "support_resolution_examples",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_support_resolution_examples_search", table_name="support_resolution_examples")
    op.drop_index("ix_support_resolution_examples_ticket_id", table_name="support_resolution_examples")
    op.drop_table("support_resolution_examples")
    op.drop_index("ix_support_tickets_handled_by", table_name="support_tickets")
    op.drop_index("ix_support_tickets_topic", table_name="support_tickets")
    op.drop_index("ix_support_tickets_status", table_name="support_tickets")
    op.drop_index("ix_support_tickets_user_id", table_name="support_tickets")
    op.drop_table("support_tickets")
    op.drop_index("ix_support_messages_created_at", table_name="support_messages")
    op.drop_index("ix_support_messages_conversation_id", table_name="support_messages")
    op.drop_table("support_messages")
    op.drop_index("uq_support_conversations_active_user", table_name="support_conversations")
    op.drop_index("ix_support_conversations_user_id", table_name="support_conversations")
    op.drop_table("support_conversations")
    op.execute("DROP SEQUENCE IF EXISTS support_ticket_public_seq")
