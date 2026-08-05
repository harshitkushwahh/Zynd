"""Disable optional MFA/PIN fund gates; contact verification remains enforced in policy code."""

from alembic import op

revision = "071_fund_gate_contact_only"
down_revision = "070_mfa_sms_phase6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE security_config
        SET value = '{"value": false}'::jsonb
        WHERE key IN ('fund.require_mfa', 'fund.require_pin')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE security_config
        SET value = '{"value": true}'::jsonb
        WHERE key IN ('fund.require_mfa', 'fund.require_pin')
        """
    )
