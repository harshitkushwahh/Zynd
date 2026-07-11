"""Revision ID: 004_phase3_security
Revises: 003_append_only_grants
"""

from typing import Sequence, Union

from alembic import op

revision: str = "004_phase3_security"
down_revision: Union[str, None] = "003_append_only_grants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_AUDIT_VALUES = [
    "oauth_connected",
    "oauth_disconnected",
    "login_velocity_flagged",
]


def upgrade() -> None:
    for value in NEW_AUDIT_VALUES:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
