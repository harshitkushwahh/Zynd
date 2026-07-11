"""Add Zynd PIN fields to users.

Revision ID: 012_zynd_pin
Revises: 011_outbox_events
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_zynd_pin"
down_revision: Union[str, None] = "011_outbox_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pin_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column("pin_set_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("pin_failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("pin_locked_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "pin_locked_until")
    op.drop_column("users", "pin_failed_attempts")
    op.drop_column("users", "pin_set_at")
    op.drop_column("users", "pin_hash")
