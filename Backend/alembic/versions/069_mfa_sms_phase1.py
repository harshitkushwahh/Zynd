"""MFA SMS phase 1 — second-factor audit events.

Revision ID: 069_mfa_sms_phase1
Revises: 068_goal_template_image
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "069_mfa_sms_phase1"
down_revision: Union[str, None] = "068_goal_template_image"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_AUDIT_EVENTS = (
    "fund_gate_blocked_pin",
    "login_sms_otp_sent",
    "login_sms_otp_verified",
    "step_up_sms_sent",
    "step_up_sms_used",
)


def upgrade() -> None:
    for value in _NEW_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
