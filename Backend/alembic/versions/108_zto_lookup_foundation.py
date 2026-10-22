"""Zero-Touch Lookup foundation tables.

Revision ID: 108_zto_lookup_foundation
Revises: 107_family_holding_links
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "108_zto_lookup_foundation"
down_revision: Union[str, None] = "107_family_holding_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)


def upgrade() -> None:
    op.create_table(
        "zto_consent_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("purpose", sa.String(length=48), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("mode", sa.String(length=24), nullable=False, server_default="checkbox"),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signup_correlation_id", sa.String(length=64), nullable=True),
        _ts("created_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zto_consent_records_user_id", "zto_consent_records", ["user_id"])

    op.create_table(
        "zto_lookup_fetches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("fp_lookup_id", sa.String(length=128), nullable=True),
        sa.Column("source_ref_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("lookup_name", sa.String(length=255), nullable=True),
        sa.Column("payload_encrypted", sa.Text(), nullable=True),
        sa.Column("key_version", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=255), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zto_lookup_fetches_user_id", "zto_lookup_fetches", ["user_id"])

    op.create_table(
        "zto_phone_registry",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lookup_kind", sa.String(length=16), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("fetch_id", sa.UUID(), nullable=True),
        _ts("created_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["fetch_id"], ["zto_lookup_fetches.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zto_phone_registry_user_id", "zto_phone_registry", ["user_id"])
    op.create_index(
        "uq_zto_phone_registry_bank",
        "zto_phone_registry",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("lookup_kind = 'bank'"),
    )
    op.create_index(
        "uq_zto_phone_registry_customer",
        "zto_phone_registry",
        ["phone", "normalized_name"],
        unique=True,
        postgresql_where=sa.text("lookup_kind = 'customer'"),
    )

    op.create_table(
        "zto_approved_profile",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bank_lookup_id", sa.UUID(), nullable=True),
        sa.Column("customer_lookup_id", sa.UUID(), nullable=True),
        sa.Column("name_from_lookup", sa.String(length=255), nullable=True),
        sa.Column("name_approved", sa.String(length=255), nullable=True),
        sa.Column("name_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pan_from_lookup", sa.String(length=16), nullable=True),
        sa.Column("pan_approved", sa.String(length=16), nullable=True),
        sa.Column("pan_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("dob_from_lookup", sa.String(length=10), nullable=True),
        sa.Column("dob_approved", sa.String(length=10), nullable=True),
        sa.Column("dob_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("bank_account_from_lookup", sa.String(length=32), nullable=True),
        sa.Column("bank_account_approved", sa.String(length=32), nullable=True),
        sa.Column("bank_account_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ifsc_from_lookup", sa.String(length=16), nullable=True),
        sa.Column("ifsc_approved", sa.String(length=16), nullable=True),
        sa.Column("ifsc_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("address_from_lookup", sa.Text(), nullable=True),
        sa.Column("address_approved", sa.Text(), nullable=True),
        sa.Column("address_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("created_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bank_lookup_id"], ["zto_lookup_fetches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_lookup_id"], ["zto_lookup_fetches.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zto_approved_profile_user_id", "zto_approved_profile", ["user_id"], unique=True)

    op.create_table(
        "zto_user_flow",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("phase", sa.String(length=32), nullable=False, server_default="LOOKUP_PENDING"),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signup_display_name", sa.String(length=255), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zto_user_flow_user_id", "zto_user_flow", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_zto_user_flow_user_id", table_name="zto_user_flow")
    op.drop_table("zto_user_flow")
    op.drop_index("ix_zto_approved_profile_user_id", table_name="zto_approved_profile")
    op.drop_table("zto_approved_profile")
    op.drop_index("uq_zto_phone_registry_customer", table_name="zto_phone_registry")
    op.drop_index("uq_zto_phone_registry_bank", table_name="zto_phone_registry")
    op.drop_index("ix_zto_phone_registry_user_id", table_name="zto_phone_registry")
    op.drop_table("zto_phone_registry")
    op.drop_index("ix_zto_lookup_fetches_user_id", table_name="zto_lookup_fetches")
    op.drop_table("zto_lookup_fetches")
    op.drop_index("ix_zto_consent_records_user_id", table_name="zto_consent_records")
    op.drop_table("zto_consent_records")
