"""Read receipts on support messages.

Revision ID: 106_support_message_read_receipts
Revises: 105_support_ai_routing
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "106_support_message_read_receipts"
down_revision: Union[str, None] = "105_support_ai_routing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "support_messages",
        sa.Column("customer_read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "support_messages",
        sa.Column("support_read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "support_messages",
        sa.Column("support_read_by", sa.String(length=16), nullable=True),
    )
    op.create_check_constraint(
        "ck_support_messages_support_read_by",
        "support_messages",
        "support_read_by IS NULL OR support_read_by IN ('bot', 'agent')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_support_messages_support_read_by", "support_messages", type_="check")
    op.drop_column("support_messages", "support_read_by")
    op.drop_column("support_messages", "support_read_at")
    op.drop_column("support_messages", "customer_read_at")
