"""Consent management platform: definitions, versions, user records, seed.

Revision ID: 093_consent_management_platform
Revises: 092_kyc_nomination_consent
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "093_consent_management_platform"
down_revision: Union[str, None] = "092_kyc_nomination_consent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

consent_channel = postgresql.ENUM("web", "distributor", "all", name="consentchannel", create_type=False)
consent_acceptance_mode = postgresql.ENUM(
    "explicit_checkbox",
    "implicit_proceed",
    name="consentacceptancemode",
    create_type=False,
)
consent_reaccept_policy = postgresql.ENUM(
    "on_new_version",
    "never",
    name="consentreacceptpolicy",
    create_type=False,
)
consent_version_status = postgresql.ENUM(
    "draft",
    "published",
    "archived",
    name="consentversionstatus",
    create_type=False,
)
user_consent_action = postgresql.ENUM("accepted", "revoked", name="userconsentaction", create_type=False)

SEED_DEFINITIONS: list[dict] = [
    {
        "key": "platform.signup_legal",
        "title": "Signup legal bundle",
        "description": "Terms, Privacy Policy, and Tariff Rates accepted at registration.",
        "channel": "web",
        "acceptance_mode": "implicit_proceed",
        "reaccept_policy": "on_new_version",
        "version_label": "v1",
        "summary_text": "I agree to the Terms & Conditions, Privacy Policy, and Tariff Rates.",
        "document_url": None,
    },
    {
        "key": "platform.terms_of_service",
        "title": "Terms of Service",
        "description": "Platform terms of service.",
        "channel": "web",
        "acceptance_mode": "implicit_proceed",
        "reaccept_policy": "on_new_version",
        "version_label": "v1",
        "summary_text": "Terms of Service",
        "document_url": None,
    },
    {
        "key": "platform.privacy_policy",
        "title": "Privacy Policy",
        "description": "Platform privacy policy.",
        "channel": "web",
        "acceptance_mode": "implicit_proceed",
        "reaccept_policy": "on_new_version",
        "version_label": "v1",
        "summary_text": "Privacy Policy",
        "document_url": None,
    },
    {
        "key": "kyc.nomination_opt_out",
        "title": "Nomination opt-out",
        "description": "SEBI-prescribed mutual fund nomination opt-out declaration.",
        "channel": "web",
        "acceptance_mode": "explicit_checkbox",
        "reaccept_policy": "never",
        "version_label": "sebi_nomination_opt_out_v1",
        "summary_text": "I do not wish to appoint a nominee and understand the legal heir transmission process.",
        "document_url": None,
    },
    {
        "key": "distributor.client_nomination_opt_out",
        "title": "Client nomination opt-out (Mitra)",
        "description": "Nomination opt-out when onboarding a client via distributor.",
        "channel": "distributor",
        "acceptance_mode": "explicit_checkbox",
        "reaccept_policy": "never",
        "version_label": "sebi_nomination_opt_out_v1",
        "summary_text": "Client opts out of nominations with SEBI disclosure.",
        "document_url": None,
    },
]


def upgrade() -> None:
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'consent_version_published'")
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'consent_accepted'")
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'consent_revoked'")
    op.execute(
        "ALTER TYPE adminactiontype ADD VALUE IF NOT EXISTS 'consent_version_publish'"
    )

    consent_channel.create(op.get_bind(), checkfirst=True)
    consent_acceptance_mode.create(op.get_bind(), checkfirst=True)
    consent_reaccept_policy.create(op.get_bind(), checkfirst=True)
    consent_version_status.create(op.get_bind(), checkfirst=True)
    user_consent_action.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "consent_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("channel", consent_channel, nullable=False),
        sa.Column("acceptance_mode", consent_acceptance_mode, nullable=False),
        sa.Column("reaccept_policy", consent_reaccept_policy, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("key", name="uq_consent_definitions_key"),
    )
    op.create_index("ix_consent_definitions_key", "consent_definitions", ["key"])

    op.create_table(
        "consent_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "consent_definition_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consent_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_label", sa.String(64), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", consent_version_status, nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=True),
        sa.Column("body_markdown", sa.Text(), nullable=True),
        sa.Column("document_url", sa.String(2048), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "published_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "consent_definition_id",
            "version_label",
            name="uq_consent_version_label",
        ),
    )
    op.create_index("ix_consent_versions_definition", "consent_versions", ["consent_definition_id"])
    op.create_index("ix_consent_versions_status", "consent_versions", ["status"])

    op.create_table(
        "user_consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "consent_definition_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consent_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "consent_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consent_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action", user_consent_action, nullable=False),
        sa.Column("source", sa.String(64), nullable=False, server_default="unknown"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_user_consent_records_user_id", "user_consent_records", ["user_id"])
    op.create_index(
        "ix_user_consent_records_definition_user",
        "user_consent_records",
        ["consent_definition_id", "user_id"],
    )
    op.create_index(
        "ix_user_consent_records_version_id",
        "user_consent_records",
        ["consent_version_id"],
    )

    conn = op.get_bind()
    now_expr = sa.text("now()")
    for item in SEED_DEFINITIONS:
        def_id = uuid.uuid4()
        ver_id = uuid.uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO consent_definitions
                    (id, key, title, description, channel, acceptance_mode, reaccept_policy, is_active, created_at, updated_at)
                VALUES
                    (:id, :key, :title, :description, CAST(:channel AS consentchannel),
                     CAST(:acceptance_mode AS consentacceptancemode),
                     CAST(:reaccept_policy AS consentreacceptpolicy), true, now(), now())
                """
            ),
            {
                "id": def_id,
                "key": item["key"],
                "title": item["title"],
                "description": item["description"],
                "channel": item["channel"],
                "acceptance_mode": item["acceptance_mode"],
                "reaccept_policy": item["reaccept_policy"],
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO consent_versions
                    (id, consent_definition_id, version_label, version_number, status,
                     summary_text, document_url, published_at, created_at, updated_at)
                VALUES
                    (:id, :def_id, :version_label, 1, CAST('published' AS consentversionstatus),
                     :summary_text, :document_url, now(), now(), now())
                """
            ),
            {
                "id": ver_id,
                "def_id": def_id,
                "version_label": item["version_label"],
                "summary_text": item["summary_text"],
                "document_url": item["document_url"],
            },
        )


def downgrade() -> None:
    op.drop_table("user_consent_records")
    op.drop_table("consent_versions")
    op.drop_table("consent_definitions")
    user_consent_action.drop(op.get_bind(), checkfirst=True)
    consent_version_status.drop(op.get_bind(), checkfirst=True)
    consent_reaccept_policy.drop(op.get_bind(), checkfirst=True)
    consent_acceptance_mode.drop(op.get_bind(), checkfirst=True)
    consent_channel.drop(op.get_bind(), checkfirst=True)
