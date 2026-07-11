"""Phase 5 notification hardening — audit events for delivery compliance.

Revision ID: 034_notification_phase5
Revises: 033_push_devices
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "034_notification_phase5"
down_revision: Union[str, None] = "033_push_devices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NOTIFICATION_AUDIT_EVENTS = (
    "notification_dispatched",
    "notification_push_failed",
)


def upgrade() -> None:
    for value in _NOTIFICATION_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
