"""Add Zynd PIN audit event types.

Revision ID: 013_zynd_pin_audit_events
Revises: 012_zynd_pin
"""

from typing import Sequence, Union

from alembic import op

revision: str = "013_zynd_pin_audit_events"
down_revision: Union[str, None] = "012_zynd_pin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PIN_AUDIT_EVENTS = (
    "pin_set",
    "pin_verify_success",
    "pin_verify_failed",
    "pin_reset_requested",
    "pin_reset",
)


def upgrade() -> None:
    for value in _PIN_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
