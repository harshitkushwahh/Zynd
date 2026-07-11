"""Investor profile foundation for future MF/payment Cybrilla v2 sync.

Revision ID: 025_investor_profile_foundation
Revises: 024_phase3_kyc_submission
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "025_investor_profile_foundation"
down_revision: Union[str, None] = "024_phase3_kyc_submission"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

investor_profile_status = postgresql.ENUM(
    "pending",
    "provisioning",
    "active",
    "failed",
    name="investorprofilestatus",
    create_type=False,
)
investor_provision_trigger = postgresql.ENUM(
    "payment",
    "mf_order",
    "mf_sip",
    "manual",
    name="investorprovisiontrigger",
    create_type=False,
)
investor_object_sync_status = postgresql.ENUM(
    "draft",
    "pending_create",
    "active",
    "failed",
    name="investorobjectsyncstatus",
    create_type=False,
)
investor_object_source = postgresql.ENUM(
    "kyc",
    "user",
    "cybrilla",
    name="investorobjectsource",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    investor_profile_status.create(bind, checkfirst=True)
    investor_provision_trigger.create(bind, checkfirst=True)
    investor_object_sync_status.create(bind, checkfirst=True)
    investor_object_source.create(bind, checkfirst=True)

    op.create_table(
        "investor_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_profile_id", sa.String(length=128), nullable=True),
        sa.Column("external_old_id", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            investor_profile_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("provision_trigger", investor_provision_trigger, nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="cybrilla_fp"),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("provisioned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("external_profile_id"),
    )

    op.create_table(
        "investor_bank_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_bank_account_id", sa.String(length=128), nullable=True),
        sa.Column("external_old_id", sa.Integer(), nullable=True),
        sa.Column(
            "sync_status",
            investor_object_sync_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "source",
            investor_object_source,
            nullable=False,
            server_default="kyc",
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("account_type", sa.String(length=32), nullable=False),
        sa.Column("account_number_last4", sa.String(length=4), nullable=False),
        sa.Column("ifsc_code", sa.String(length=11), nullable=False),
        sa.Column("primary_account_holder_name", sa.String(length=120), nullable=False),
        sa.Column("bank_name", sa.String(length=120), nullable=True),
        sa.Column("branch_name", sa.String(length=120), nullable=True),
        sa.Column("cancelled_cheque_file_id", sa.String(length=128), nullable=True),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("external_payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["investor_profile_id"], ["investor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_bank_account_id"),
        sa.UniqueConstraint(
            "investor_profile_id",
            "account_number_last4",
            "ifsc_code",
            name="uq_investor_bank_account_fingerprint",
        ),
    )
    op.create_index("ix_investor_bank_accounts_investor_profile_id", "investor_bank_accounts", ["investor_profile_id"])

    op.create_table(
        "investor_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_address_id", sa.String(length=128), nullable=True),
        sa.Column(
            "sync_status",
            investor_object_sync_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "source",
            investor_object_source,
            nullable=False,
            server_default="kyc",
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("nature", sa.String(length=32), nullable=False, server_default="residential"),
        sa.Column("line1", sa.String(length=255), nullable=False),
        sa.Column("line2", sa.String(length=255), nullable=True),
        sa.Column("line3", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("postal_code", sa.String(length=16), nullable=False),
        sa.Column("country", sa.String(length=8), nullable=False, server_default="IN"),
        sa.Column("external_payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["investor_profile_id"], ["investor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_address_id"),
    )
    op.create_index("ix_investor_addresses_investor_profile_id", "investor_addresses", ["investor_profile_id"])

    op.create_table(
        "investor_email_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_email_id", sa.String(length=128), nullable=True),
        sa.Column(
            "sync_status",
            investor_object_sync_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "source",
            investor_object_source,
            nullable=False,
            server_default="user",
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("belongs_to", sa.String(length=32), nullable=True),
        sa.Column("external_payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["investor_profile_id"], ["investor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_email_id"),
        sa.UniqueConstraint("investor_profile_id", "email", name="uq_investor_profile_email"),
    )
    op.create_index(
        "ix_investor_email_addresses_investor_profile_id",
        "investor_email_addresses",
        ["investor_profile_id"],
    )

    op.create_table(
        "investor_phone_numbers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_phone_id", sa.String(length=128), nullable=True),
        sa.Column(
            "sync_status",
            investor_object_sync_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "source",
            investor_object_source,
            nullable=False,
            server_default="user",
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("isd", sa.String(length=8), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("belongs_to", sa.String(length=32), nullable=True),
        sa.Column("external_payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["investor_profile_id"], ["investor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_phone_id"),
        sa.UniqueConstraint("investor_profile_id", "isd", "number", name="uq_investor_profile_phone"),
    )
    op.create_index(
        "ix_investor_phone_numbers_investor_profile_id",
        "investor_phone_numbers",
        ["investor_profile_id"],
    )

    op.create_table(
        "investor_related_parties",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_related_party_id", sa.String(length=128), nullable=True),
        sa.Column("local_nominee_id", sa.String(length=64), nullable=True),
        sa.Column(
            "sync_status",
            investor_object_sync_status,
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "source",
            investor_object_source,
            nullable=False,
            server_default="kyc",
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("party_relationship", sa.String(length=64), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("pan", sa.String(length=10), nullable=True),
        sa.Column("guardian_name", sa.String(length=120), nullable=True),
        sa.Column("guardian_pan", sa.String(length=10), nullable=True),
        sa.Column("share_percent", sa.SmallInteger(), nullable=True),
        sa.Column("external_payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["investor_profile_id"], ["investor_profiles.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_related_party_id"),
    )
    op.create_index(
        "ix_investor_related_parties_investor_profile_id",
        "investor_related_parties",
        ["investor_profile_id"],
    )
    op.create_index(
        "ix_investor_related_parties_local_nominee_id",
        "investor_related_parties",
        ["local_nominee_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_investor_related_parties_local_nominee_id", table_name="investor_related_parties")
    op.drop_index("ix_investor_related_parties_investor_profile_id", table_name="investor_related_parties")
    op.drop_table("investor_related_parties")

    op.drop_index("ix_investor_phone_numbers_investor_profile_id", table_name="investor_phone_numbers")
    op.drop_table("investor_phone_numbers")

    op.drop_index("ix_investor_email_addresses_investor_profile_id", table_name="investor_email_addresses")
    op.drop_table("investor_email_addresses")

    op.drop_index("ix_investor_addresses_investor_profile_id", table_name="investor_addresses")
    op.drop_table("investor_addresses")

    op.drop_index("ix_investor_bank_accounts_investor_profile_id", table_name="investor_bank_accounts")
    op.drop_table("investor_bank_accounts")

    op.drop_table("investor_profiles")

    bind = op.get_bind()
    investor_object_source.drop(bind, checkfirst=True)
    investor_object_sync_status.drop(bind, checkfirst=True)
    investor_provision_trigger.drop(bind, checkfirst=True)
    investor_profile_status.drop(bind, checkfirst=True)
