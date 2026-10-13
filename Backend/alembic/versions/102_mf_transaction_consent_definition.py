"""Add mf.transaction_authorization consent definition.

Revision ID: 102_mf_transaction_consent
Revises: 101_nfo_offer_audit
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "102_mf_transaction_consent"
down_revision: Union[str, None] = "101_nfo_offer_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
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
            ON CONFLICT (key) DO NOTHING
            """
        ),
        {
            "id": def_id,
            "key": "mf.transaction_authorization",
            "title": "Mutual fund transaction authorization",
            "description": "OTP confirmation before switch, redemption, SIP plan, and related MF transactions.",
            "channel": "web",
            "acceptance_mode": "explicit_checkbox",
            "reaccept_policy": "never",
        },
    )
    row = conn.execute(
        sa.text("SELECT id FROM consent_definitions WHERE key = :key LIMIT 1"),
        {"key": "mf.transaction_authorization"},
    ).first()
    if not row:
        return
    resolved_def_id = row[0]
    conn.execute(
        sa.text(
            """
            INSERT INTO consent_versions
                (id, consent_definition_id, version_label, version_number, status,
                 summary_text, document_url, published_at, created_at, updated_at)
            VALUES
                (:id, :def_id, :version_label, 1, CAST('published' AS consentversionstatus),
                 :summary_text, NULL, now(), now(), now())
            ON CONFLICT ON CONSTRAINT uq_consent_version_label DO NOTHING
            """
        ),
        {
            "id": ver_id,
            "def_id": resolved_def_id,
            "version_label": "v1",
            "summary_text": "I authorize this mutual fund transaction after verifying the OTP sent to my registered mobile and email.",
        },
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM consent_versions
            WHERE consent_definition_id IN (
                SELECT id FROM consent_definitions WHERE key = :key
            )
            """
        ),
        {"key": "mf.transaction_authorization"},
    )
    conn.execute(
        sa.text("DELETE FROM consent_definitions WHERE key = :key"),
        {"key": "mf.transaction_authorization"},
    )
