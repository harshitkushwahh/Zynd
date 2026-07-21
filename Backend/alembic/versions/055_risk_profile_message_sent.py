"""Add risk profile message sent audit event.

Revision ID: 055_risk_profile_message_sent
Revises: 054_risk_profile_templates
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "055_risk_profile_message_sent"
down_revision: Union[str, None] = "054_risk_profile_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'risk_profile_message_sent'")


def downgrade() -> None:
    pass
