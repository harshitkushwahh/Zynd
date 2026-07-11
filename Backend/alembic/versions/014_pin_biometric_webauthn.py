"""Add WebAuthn credential purpose for PIN biometric unlock.

Revision ID: 014_pin_biometric_webauthn
Revises: 013_zynd_pin_audit_events
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_pin_biometric_webauthn"
down_revision: Union[str, None] = "013_zynd_pin_audit_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "webauthn_credentials",
        sa.Column(
            "purpose",
            sa.String(length=32),
            nullable=False,
            server_default="passkey",
        ),
    )
    op.create_index(
        "ix_webauthn_credentials_user_purpose",
        "webauthn_credentials",
        ["user_id", "purpose"],
    )

    for value in (
        "pin_biometric_enrolled",
        "pin_biometric_unlock_success",
        "pin_biometric_unlock_failed",
    ):
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_index("ix_webauthn_credentials_user_purpose", table_name="webauthn_credentials")
    op.drop_column("webauthn_credentials", "purpose")
