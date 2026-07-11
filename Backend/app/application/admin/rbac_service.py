from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
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
}


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


async def list_admin_roles(db: AsyncSession) -> list[dict[str, object]]:
    roles = list((await db.execute(select(AdminRole))).scalars())
    payload: list[dict[str, object]] = []
    for role in roles:
        permission_result = await db.execute(
            select(AdminPermission.key)
            .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
            .where(AdminRolePermission.role_id == role.id)
        )
        payload.append(
            {
                "key": role.key,
                "name": role.name,
                "description": role.description,
                "permissions": list(permission_result.scalars()),
            }
        )
    return payload


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
