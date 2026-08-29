"""Seed Funds For You recommendation RBAC permissions for super_admin.

Revision ID: 089_recommendation_rbac_permissions
Revises: 088_recommendation_baskets
Create Date: 2026-08-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "089_recommendation_rbac_permissions"
down_revision: Union[str, None] = "088_recommendation_baskets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RECOMMENDATION_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("recommendations.read", "View recommendation baskets, preview, and config version"),
    ("recommendations.manage", "CRUD recommendation baskets and fund pools"),
    ("recommendations.publish", "Publish recommendation configuration"),
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
    for key, description in RECOMMENDATION_PERMISSIONS:
        _insert_permission(key, description)
        _grant_super_admin(key)


def downgrade() -> None:
    permission_keys = [key for key, _ in RECOMMENDATION_PERMISSIONS]
    op.execute(
        sa.text(
            """
            DELETE FROM admin_role_permissions arp
            USING admin_permissions p
            WHERE arp.permission_id = p.id
              AND p.key = ANY(:permission_keys)
            """
        ).bindparams(permission_keys=permission_keys),
    )
    op.execute(
        sa.text(
            """
            DELETE FROM admin_permissions
            WHERE key = ANY(:permission_keys)
            """
        ).bindparams(permission_keys=permission_keys),
    )
