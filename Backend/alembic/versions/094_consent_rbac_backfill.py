"""Consent RBAC permissions and backfill KYC nomination opt-out records.

Revision ID: 094_consent_rbac_backfill
Revises: 093_consent_management_platform
"""

from __future__ import annotations

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "094_consent_rbac_backfill"
down_revision: Union[str, None] = "093_consent_management_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSENT_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("consents.read", "View consent definitions, versions, and acceptance statistics"),
    ("consents.manage", "Create consent versions and request publish"),
    ("consents.records.read", "View per-user consent acceptance history"),
)


def _insert_permission(key: str, description: str) -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO admin_permissions (id, key, description)
            SELECT gen_random_uuid(), :key, :description
            WHERE NOT EXISTS (
                SELECT 1 FROM admin_permissions WHERE key = :key
            )
            """
        ).bindparams(key=key, description=description),
    )


def _grant_super_admin(permission_key: str) -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO admin_role_permissions (id, role_id, permission_id)
            SELECT gen_random_uuid(), r.id, p.id
            FROM admin_roles r
            CROSS JOIN admin_permissions p
            WHERE r.key = 'super_admin'
              AND p.key = :permission_key
              AND NOT EXISTS (
                  SELECT 1
                  FROM admin_role_permissions arp
                  WHERE arp.role_id = r.id
                    AND arp.permission_id = p.id
              )
            """
        ).bindparams(permission_key=permission_key),
    )


def upgrade() -> None:
    for key, description in CONSENT_PERMISSIONS:
        _insert_permission(key, description)
        _grant_super_admin(key)

    conn = op.get_bind()
    def_row = conn.execute(
        sa.text("SELECT id FROM consent_definitions WHERE key = 'kyc.nomination_opt_out' LIMIT 1")
    ).first()
    if not def_row:
        return
    definition_id = def_row[0]
    ver_row = conn.execute(
        sa.text(
            """
            SELECT id FROM consent_versions
            WHERE consent_definition_id = :def_id AND status = 'published'
            ORDER BY version_number DESC LIMIT 1
            """
        ),
        {"def_id": definition_id},
    ).first()
    if not ver_row:
        return
    version_id = ver_row[0]

    journeys = conn.execute(
        sa.text(
            """
            SELECT user_id, nomination_consent_json
            FROM kyc_journey_states
            WHERE nomination_consent_json IS NOT NULL
            """
        )
    ).fetchall()

    for user_id, consent_json in journeys:
        if not consent_json:
            continue
        if isinstance(consent_json, str):
            consent_json = json.loads(consent_json)
        if not isinstance(consent_json, dict) or not consent_json.get("active"):
            continue
        records = consent_json.get("records") or []
        if not records:
            continue
        exists = conn.execute(
            sa.text(
                """
                SELECT 1 FROM user_consent_records
                WHERE user_id = :user_id AND consent_definition_id = :def_id
                LIMIT 1
                """
            ),
            {"user_id": user_id, "def_id": definition_id},
        ).first()
        if exists:
            continue
        conn.execute(
            sa.text(
                """
                INSERT INTO user_consent_records
                    (id, user_id, consent_definition_id, consent_version_id,
                     action, source, metadata, created_at)
                VALUES
                    (:id, :user_id, :def_id, :ver_id, 'accepted', 'kyc_migration_backfill', NULL, now())
                """
            ),
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "def_id": definition_id,
                "ver_id": version_id,
            },
        )


def downgrade() -> None:
    pass
