from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import (
    AdminPermission,
    AdminRole,
    AdminRolePermission,
    AdminUserRoleAssignment,
    User,
    UserRole,
)

PERMISSIONS: list[tuple[str, str]] = [
    ("security_reviews.read", "View flagged login security reviews"),
    ("security_reviews.resolve", "Resolve or dismiss security reviews"),
    ("audit.read", "Read audit log summaries"),
    ("users.read", "View user account summaries"),
    ("users.suspend", "Request account suspension and unsuspension"),
    ("admin_actions.approve", "Approve or reject high-impact admin action requests"),
    ("security.manage", "Request security configuration changes"),
    ("rbac.manage", "Manage admin roles and assignments"),
    ("encryption.rotate", "Rotate encrypted secrets to the current key version"),
    ("transactions.execute", "Execute money-moving transaction requests"),
    ("retention.read", "View regulatory retention schedule"),
    ("deletion.execute", "Run account deletion executor and view pending deletions"),
    ("documents.read", "View user document metadata"),
    ("documents.download", "Download user documents for compliance review"),
    ("documents.verify", "Verify KYC documents and apply WORM immutability"),
    ("documents.legal_hold", "Place or release legal hold on documents"),
    ("documents.delete", "Break-glass deletion of protected documents"),
    ("mf.jobs.read", "View MF ingestion jobs, runs, and metrics"),
    ("mf.jobs.run", "Manually trigger MF ingestion jobs"),
    ("mf.amcs.read", "View mutual fund AMC empanelment status"),
    ("mf.amcs.manage", "Update AMC empanelment and AMFI codes"),
    ("mf.catalog.read", "View mutual fund catalog, categories, and NAV history"),
    ("mf.catalog.manage", "Update mutual fund catalog visibility and investability overrides"),
    ("mf.content.manage", "Edit mutual fund display content and compliance settings"),
    ("mf.rules.manage", "Create and update mutual fund catalog automation rules"),
    ("mf.catalog.publish", "Apply catalog rules and bulk catalog mutations"),
    ("mf.transactions.read", "View MF orders, checkouts, SIP plans, mandates, and webhooks"),
    ("mf.transactions.manage", "Reconcile MF transactions, replay webhooks, and expire stale checkouts"),
    ("mf.integrations.read", "View mutual fund provider integration status and environment"),
    ("mf.integrations.manage", "Switch mutual fund provider integration test/live environments"),
]

ROLES: dict[str, dict[str, object]] = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Full platform administration access.",
        "permissions": [key for key, _ in PERMISSIONS],
    },
    "compliance_officer": {
        "name": "Compliance Officer",
        "description": "Review security events and audit activity.",
        "permissions": [
            "security_reviews.read",
            "security_reviews.resolve",
            "audit.read",
            "users.read",
            "users.suspend",
            "admin_actions.approve",
            "security.manage",
            "retention.read",
            "deletion.execute",
            "documents.read",
            "documents.download",
            "documents.verify",
            "documents.legal_hold",
        ],
    },
    "support_agent": {
        "name": "Support Agent",
        "description": "Read-only support access for user lookups and open reviews.",
        "permissions": ["security_reviews.read", "users.read", "documents.read"],
    },
    "operations": {
        "name": "Operations",
        "description": "Run and monitor mutual fund ingestion jobs.",
        "permissions": [
            "mf.jobs.read",
            "mf.jobs.run",
            "mf.amcs.manage",
            "mf.catalog.read",
            "mf.catalog.manage",
            "mf.content.manage",
            "mf.rules.manage",
            "mf.transactions.read",
            "mf.transactions.manage",
            "mf.integrations.read",
            "mf.integrations.manage",
            "audit.read",
        ],
    },
    "catalog_publisher": {
        "name": "Catalog Publisher",
        "description": "Apply MF catalog rules and bulk publish operations.",
        "permissions": [
            "mf.catalog.read",
            "mf.rules.manage",
            "mf.catalog.publish",
            "admin_actions.approve",
            "audit.read",
        ],
    },
}

SEEDED_ROLE_KEYS = frozenset(ROLES.keys())
PERMISSION_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]+)+$")
ROLE_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]+$")


async def ensure_rbac_seed(db: AsyncSession) -> None:
    permission_rows: dict[str, AdminPermission] = {}
    for key, description in PERMISSIONS:
        result = await db.execute(select(AdminPermission).where(AdminPermission.key == key))
        row = result.scalar_one_or_none()
        if not row:
            row = AdminPermission(key=key, description=description)
            db.add(row)
            await db.flush()
        permission_rows[key] = row

    role_rows: dict[str, AdminRole] = {}
    for role_key, config in ROLES.items():
        result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
        row = result.scalar_one_or_none()
        if not row:
            row = AdminRole(
                key=role_key,
                name=str(config["name"]),
                description=str(config["description"]),
            )
            db.add(row)
            await db.flush()
        role_rows[role_key] = row

        desired_permission_ids = {
            permission_rows[permission_key].id for permission_key in config["permissions"]  # type: ignore[index]
        }
        existing = await db.execute(
            select(AdminRolePermission).where(AdminRolePermission.role_id == row.id)
        )
        current_permission_ids = {item.permission_id for item in existing.scalars()}
        for permission_id in desired_permission_ids - current_permission_ids:
            db.add(AdminRolePermission(role_id=row.id, permission_id=permission_id))

    await db.flush()

    admin_users = await db.execute(select(User).where(User.role == UserRole.admin))
    super_admin_role = role_rows["super_admin"]
    for admin_user in admin_users.scalars():
        assignment = await db.execute(
            select(AdminUserRoleAssignment).where(
                AdminUserRoleAssignment.user_id == admin_user.id,
                AdminUserRoleAssignment.role_id == super_admin_role.id,
            )
        )
        if assignment.scalar_one_or_none() is None:
            db.add(AdminUserRoleAssignment(user_id=admin_user.id, role_id=super_admin_role.id))

    await db.flush()


async def get_user_permission_keys(db: AsyncSession, user_id: UUID) -> set[str]:
    result = await db.execute(
        select(AdminPermission.key)
        .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
        .join(AdminRole, AdminRole.id == AdminRolePermission.role_id)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.role_id == AdminRole.id)
        .where(AdminUserRoleAssignment.user_id == user_id)
    )
    return set(result.scalars())


async def _role_permission_keys(db: AsyncSession, role_id: UUID) -> list[str]:
    permission_result = await db.execute(
        select(AdminPermission.key)
        .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
        .where(AdminRolePermission.role_id == role_id)
        .order_by(AdminPermission.key)
    )
    return list(permission_result.scalars())


async def _serialize_admin_role(db: AsyncSession, role: AdminRole) -> dict[str, object]:
    return {
        "key": role.key,
        "name": role.name,
        "description": role.description,
        "permissions": await _role_permission_keys(db, role.id),
        "is_system": role.key in SEEDED_ROLE_KEYS,
    }


async def _get_permission_rows_by_keys(
    db: AsyncSession,
    permission_keys: list[str],
) -> dict[str, AdminPermission]:
    if not permission_keys:
        return {}
    unique_keys = sorted(set(permission_keys))
    result = await db.execute(
        select(AdminPermission).where(AdminPermission.key.in_(unique_keys))
    )
    rows = {row.key: row for row in result.scalars()}
    missing = [key for key in unique_keys if key not in rows]
    if missing:
        raise ValueError(f"Unknown permissions: {', '.join(missing)}")
    return rows


async def list_admin_permissions(db: AsyncSession) -> list[dict[str, str]]:
    result = await db.execute(select(AdminPermission).order_by(AdminPermission.key))
    return [{"key": row.key, "description": row.description} for row in result.scalars()]


async def create_admin_permission(
    db: AsyncSession,
    *,
    key: str,
    description: str,
) -> dict[str, str]:
    normalized_key = key.strip().lower()
    if not PERMISSION_KEY_PATTERN.fullmatch(normalized_key):
        raise ValueError("Permission key must look like area.action (for example users.read).")
    existing = await db.execute(
        select(AdminPermission).where(AdminPermission.key == normalized_key)
    )
    if existing.scalar_one_or_none():
        raise ValueError("Permission already exists.")
    row = AdminPermission(key=normalized_key, description=description.strip())
    db.add(row)
    await db.flush()
    return {"key": row.key, "description": row.description}


async def list_admin_roles(db: AsyncSession) -> list[dict[str, object]]:
    roles = list((await db.execute(select(AdminRole).order_by(AdminRole.name))).scalars())
    payload: list[dict[str, object]] = []
    for role in roles:
        payload.append(await _serialize_admin_role(db, role))
    return payload


async def create_admin_role(
    db: AsyncSession,
    *,
    key: str,
    name: str,
    description: str,
    permission_keys: list[str],
) -> dict[str, object]:
    normalized_key = key.strip().lower()
    if not ROLE_KEY_PATTERN.fullmatch(normalized_key):
        raise ValueError("Role key must use lowercase letters, numbers, and underscores.")
    existing = await db.execute(select(AdminRole).where(AdminRole.key == normalized_key))
    if existing.scalar_one_or_none():
        raise ValueError("Role already exists.")

    permission_rows = await _get_permission_rows_by_keys(db, permission_keys)
    role = AdminRole(
        key=normalized_key,
        name=name.strip(),
        description=description.strip(),
    )
    db.add(role)
    await db.flush()
    for permission in permission_rows.values():
        db.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))
    await db.flush()
    return await _serialize_admin_role(db, role)


async def update_admin_role(
    db: AsyncSession,
    *,
    role_key: str,
    name: str | None = None,
    description: str | None = None,
    permission_keys: list[str] | None = None,
) -> dict[str, object]:
    role_result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
    role = role_result.scalar_one_or_none()
    if not role:
        raise ValueError("Role not found.")

    if name is not None:
        role.name = name.strip()
    if description is not None:
        role.description = description.strip()

    if permission_keys is not None:
        permission_rows = await _get_permission_rows_by_keys(db, permission_keys)
        await db.execute(delete(AdminRolePermission).where(AdminRolePermission.role_id == role.id))
        for permission in permission_rows.values():
            db.add(AdminRolePermission(role_id=role.id, permission_id=permission.id))

    await db.flush()
    return await _serialize_admin_role(db, role)


async def delete_admin_role(db: AsyncSession, *, role_key: str) -> None:
    if role_key in SEEDED_ROLE_KEYS:
        raise ValueError("Built-in roles cannot be deleted.")

    role_result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
    role = role_result.scalar_one_or_none()
    if not role:
        raise ValueError("Role not found.")

    assignment_count = await db.execute(
        select(func.count())
        .select_from(AdminUserRoleAssignment)
        .where(AdminUserRoleAssignment.role_id == role.id)
    )
    if int(assignment_count.scalar_one()) > 0:
        raise ValueError("Remove this role from all admin users before deleting it.")

    await db.delete(role)
    await db.flush()


async def user_has_permission(db: AsyncSession, user_id: UUID, permission_key: str) -> bool:
    permissions = await get_user_permission_keys(db, user_id)
    return permission_key in permissions


async def list_user_role_keys(db: AsyncSession, user_id: UUID) -> list[str]:
    result = await db.execute(
        select(AdminRole.key)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.role_id == AdminRole.id)
        .where(AdminUserRoleAssignment.user_id == user_id)
    )
    return list(result.scalars())


async def assign_role_to_admin_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    role_key: str,
) -> list[str]:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found.")
    if user.role != UserRole.admin:
        raise ValueError("RBAC roles can only be assigned to admin users.")

    role_result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
    role = role_result.scalar_one_or_none()
    if not role:
        raise ValueError("Role not found.")

    existing = await db.execute(
        select(AdminUserRoleAssignment).where(
            AdminUserRoleAssignment.user_id == user_id,
            AdminUserRoleAssignment.role_id == role.id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Role is already assigned.")

    db.add(AdminUserRoleAssignment(user_id=user_id, role_id=role.id))
    await db.flush()
    return await list_user_role_keys(db, user_id)


async def revoke_role_from_admin_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    role_key: str,
) -> list[str]:
    role_result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
    role = role_result.scalar_one_or_none()
    if not role:
        raise ValueError("Role not found.")

    assignment = await db.execute(
        select(AdminUserRoleAssignment).where(
            AdminUserRoleAssignment.user_id == user_id,
            AdminUserRoleAssignment.role_id == role.id,
        )
    )
    row = assignment.scalar_one_or_none()
    if not row:
        raise ValueError("Role assignment not found.")

    remaining = await db.execute(
        select(AdminUserRoleAssignment.id).where(AdminUserRoleAssignment.user_id == user_id)
    )
    if len(list(remaining.scalars())) <= 1:
        raise ValueError("Cannot revoke the last assigned role.")

    await db.delete(row)
    await db.flush()
    return await list_user_role_keys(db, user_id)


async def set_admin_user_roles(
    db: AsyncSession,
    *,
    user_id: UUID,
    role_keys: list[str],
) -> list[str]:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found.")
    if user.role != UserRole.admin:
        raise ValueError("RBAC roles can only be assigned to admin users.")

    unique_role_keys = sorted(set(role_keys))
    if not unique_role_keys:
        raise ValueError("At least one team role is required.")

    role_result = await db.execute(select(AdminRole).where(AdminRole.key.in_(unique_role_keys)))
    role_rows = {row.key: row for row in role_result.scalars()}
    missing = [key for key in unique_role_keys if key not in role_rows]
    if missing:
        raise ValueError(f"Unknown roles: {', '.join(missing)}")

    desired_role_ids = {role_rows[key].id for key in unique_role_keys}

    existing = await db.execute(
        select(AdminUserRoleAssignment).where(AdminUserRoleAssignment.user_id == user_id)
    )
    current_assignments = list(existing.scalars())

    current_role_ids = {assignment.role_id for assignment in current_assignments}
    for assignment in current_assignments:
        if assignment.role_id not in desired_role_ids:
            await db.delete(assignment)

    for role_id in desired_role_ids - current_role_ids:
        db.add(AdminUserRoleAssignment(user_id=user_id, role_id=role_id))

    await db.flush()
    return await list_user_role_keys(db, user_id)
