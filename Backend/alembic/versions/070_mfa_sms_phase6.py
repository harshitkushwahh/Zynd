"""MFA SMS phase 6 — fund gate contact audit event.

Revision ID: 070_mfa_sms_phase6
Revises: 069_mfa_sms_phase1
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "070_mfa_sms_phase6"
down_revision: Union[str, None] = "069_mfa_sms_phase1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'fund_gate_blocked_contact'"
    )


def downgrade() -> None:
    pass
