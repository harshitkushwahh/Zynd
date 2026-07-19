"""Investor bank accounts — multi-account verification + encrypted account numbers.

Revision ID: 050_investor_bank_accounts_multi
Revises: 049_mf_sip_cart
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "050_investor_bank_accounts_multi"
down_revision: Union[str, None] = "049_mf_sip_cart"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

investor_bank_verification_status = postgresql.ENUM(
    "pending",
    "verified",
    "manual_required",
    "failed",
    name="investorbankverificationstatus",
    create_type=True,
)


def upgrade() -> None:
    investor_bank_verification_status.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "investor_bank_accounts",
        sa.Column("poa_preverify_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column("pan_account_holder_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column(
            "verification_status",
            investor_bank_verification_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column("verification_failure_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column("account_number_ciphertext", sa.Text(), nullable=True),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column("account_number_key_version", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "investor_bank_accounts",
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Backfill verification metadata from KYC journey for existing seeded rows.
    op.execute(
        """
        UPDATE investor_bank_accounts AS iba
        SET
            poa_preverify_id = kjs.poa_bank_preverify_id,
            pan_account_holder_name = COALESCE(
                NULLIF(kjs.bank_draft_json->>'panAccountHolderName', ''),
                NULLIF(kjs.bank_draft_json->>'accountHolderName', '')
            ),
            verification_status = CASE kjs.bank_verification_status
                WHEN 'verified' THEN 'verified'::investorbankverificationstatus
                WHEN 'manual_required' THEN 'manual_required'::investorbankverificationstatus
                WHEN 'failed' THEN 'failed'::investorbankverificationstatus
                ELSE 'pending'::investorbankverificationstatus
            END,
            verification_failure_json = kjs.bank_verification_failure_json,
            metadata_json = jsonb_strip_nulls(
                jsonb_build_object(
                    'readinessVerified', COALESCE((kjs.bank_draft_json->>'readinessVerified')::boolean, false),
                    'poaAccountType', kjs.bank_draft_json->>'poaAccountType',
                    'seededFrom', 'kyc_backfill'
                )
            )
        FROM kyc_journey_states AS kjs
        WHERE iba.investor_profile_id = kjs.user_id
          AND kjs.bank_draft_json IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("investor_bank_accounts", "metadata_json")
    op.drop_column("investor_bank_accounts", "account_number_key_version")
    op.drop_column("investor_bank_accounts", "account_number_ciphertext")
    op.drop_column("investor_bank_accounts", "verification_failure_json")
    op.drop_column("investor_bank_accounts", "verification_status")
    op.drop_column("investor_bank_accounts", "pan_account_holder_name")
    op.drop_column("investor_bank_accounts", "poa_preverify_id")

    investor_bank_verification_status.drop(op.get_bind(), checkfirst=True)
