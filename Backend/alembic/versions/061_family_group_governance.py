"""Family group governance audit events — Phase 2.

Revision ID: 061_family_group_governance
Revises: 060_family_group_invites
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "061_family_group_governance"
down_revision: Union[str, None] = "060_family_group_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GOVERNANCE_AUDIT_EVENTS = (
    "family_group_member_role_changed",
    "family_group_member_removed",
    "family_group_member_left",
    "family_group_head_transferred",
)


def upgrade() -> None:
    for value in _GOVERNANCE_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
