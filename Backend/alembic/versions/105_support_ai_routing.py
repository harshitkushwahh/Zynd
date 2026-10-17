"""Support AI routing metadata and audit events.

Revision ID: 105_support_ai_routing
Revises: 104_support_ticket_attachments
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "105_support_ai_routing"
down_revision: Union[str, None] = "104_support_ticket_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "support_tickets",
        sa.Column("routing_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_table(
        "support_ticket_routing_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("support_tickets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("trigger", sa.String(length=32), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("support_ticket_routing_events")
    op.drop_column("support_tickets", "routing_metadata")
