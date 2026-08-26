"""Add admin_account_removed audit event type.

Revision ID: 083_admin_account_removed_audit_event
Revises: 082_referral_program_leaderboard
Create Date: 2026-08-15
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "083_admin_account_removed_audit_event"
down_revision: Union[str, None] = "082_referral_program_leaderboard"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'admin_account_removed'")


def downgrade() -> None:
    pass
