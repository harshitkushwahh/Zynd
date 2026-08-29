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
    UserStatus,
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
    ("admin.accounts.manage", "Manage platform admin account access and offboarding"),
    ("documents.read", "View user document metadata"),
    ("documents.download", "Download user documents for compliance review"),
    ("documents.verify", "Verify KYC documents and apply WORM immutability"),
    ("documents.legal_hold", "Place or release legal hold on documents"),
    ("documents.delete", "Break-glass deletion of protected documents"),
    ("mf.jobs.read", "View MF ingestion jobs, runs, and metrics"),
    ("mf.jobs.run", "Manually trigger MF ingestion jobs"),
    ("mf.pipeline.run", "Run full MF bootstrap pipelines (start, resume, cancel)"),
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
    ("risk_profile.read", "View risk profile categories, questions, tiers, and score previews"),
    ("risk_profile.categories.manage", "Create and update risk profile question categories"),
    ("risk_profile.questions.manage", "Create, update, and deactivate risk profile questions"),
    ("risk_profile.tiers.manage", "Update risk tier score bands and user messages"),
    ("risk_profile.users.read", "View computed risk profiles for users"),
    ("risk_profile.users.manage", "Unlock locked risk profile attempts for users"),
    ("risk_profile.templates.manage", "Create and update risk profile assessment templates"),
    ("recommendations.read", "View recommendation baskets, preview, and config version"),
    ("recommendations.manage", "CRUD recommendation baskets and fund pools"),
    ("recommendations.publish", "Publish recommendation configuration"),
    ("family_groups.read", "View family groups, members, and invites"),
    ("family_groups.manage", "Moderate family groups and force-remove members"),
    ("referrals.read", "View referral attributions, metrics, and user referral activity"),
    ("referrals.manage", "Manage referral codes and referral program overrides"),
    ("goals.templates.read", "View predefined goal templates"),
    ("goals.templates.manage", "Update predefined goal templates"),
    ("distributor.clients.list", "List investor clients in the distributor console"),
    ("distributor.clients.read", "View masked investor client profiles in the distributor console"),
    ("distributor.clients.onboard", "Onboard investors into the Zynd Mitra book"),
    ("distributor.compliance.list", "View compliance queue for book clients"),
    ("distributor.txn_recommendations.create", "Send quick transaction recommendation links to book clients"),
    ("distributor.txn_recommendations.read", "View quick transaction recommendations sent from the Mitra console"),
    ("distributor.partners.list", "List Zynd Mitras onboarded by the branch manager"),
    ("distributor.partners.manage", "Onboard and manage Zynd Mitras for the branch"),
    ("distributor.work.manage", "Sign in and out for work and view attendance records"),
    ("distributor.leave.apply", "Apply for leave from the Zynd Mitra console"),
    ("distributor.leave.review", "Review branch Mitra leave requests"),
    ("distributor.payroll.read", "View payroll, incentives, and promotions in My work"),
    ("admin.distributor_promotions.manage", "Grant Zynd Mitra salary promotions"),
    ("admin.distributor_partners.list", "Review pending Zynd Mitra onboarding applications"),
    ("admin.distributor_partners.approve", "Approve or reject Zynd Mitra onboarding applications"),
    ("admin.distributor_hierarchy.read", "View Mitra hierarchy branches, managers, and partners"),
    ("admin.distributor_branches.list", "List distributor branches in admin hierarchy"),
    ("admin.distributor_branches.manage", "Create and update distributor branches"),
    ("admin.distributor_branches.approve", "Approve or reject branch opening requests"),
    ("admin.distributor_managers.list", "List branch managers in admin hierarchy"),
]

MITRA_ROLE_KEY = "mitra"
MITRA_MANAGER_ROLE_KEY = "mitra_manager"
MITRA_SUPER_HEAD_ROLE_KEY = "mitra_super_head"
MITRA_STATE_HEAD_ROLE_KEY = "mitra_state_head"
SUPER_ADMIN_ROLE_KEY = "super_admin"
# Backward-compatible aliases used by distributor services and tests.
DISTRIBUTOR_PARTNER_ROLE_KEY = MITRA_ROLE_KEY
DISTRIBUTOR_MANAGER_ROLE_KEY = MITRA_MANAGER_ROLE_KEY
DISTRIBUTOR_CONSOLE_ROLE_KEYS = frozenset({MITRA_ROLE_KEY, MITRA_MANAGER_ROLE_KEY})
ADMIN_CONSOLE_ROLE_KEYS = frozenset(
    {
        SUPER_ADMIN_ROLE_KEY,
        MITRA_SUPER_HEAD_ROLE_KEY,
        MITRA_STATE_HEAD_ROLE_KEY,
    }
)

ROLE_KEY_MIGRATIONS: dict[str, str] = {
    "distributor_console": MITRA_ROLE_KEY,
    "distributor_manager": MITRA_MANAGER_ROLE_KEY,
}

REMOVED_BUILTIN_ROLE_KEYS = frozenset(
    {
        "compliance_officer",
        "support_agent",
        "operations",
        "catalog_publisher",
        "distributor_console",
        "distributor_manager",
    }
)

ROLES: dict[str, dict[str, object]] = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Full platform administration access.",
        "permissions": [key for key, _ in PERMISSIONS],
    },
    "mitra_super_head": {
        "name": "Mitra Super Head",
        "description": "Platform-wide Mitra hierarchy administration.",
        "permissions": [
            "admin.distributor_hierarchy.read",
            "admin.distributor_branches.list",
            "admin.distributor_branches.manage",
            "admin.distributor_branches.approve",
            "admin.distributor_managers.list",
            "admin.distributor_partners.list",
            "admin.distributor_partners.approve",
            "admin.distributor_promotions.manage",
        ],
    },
    "mitra_state_head": {
        "name": "Mitra State Head",
        "description": "State-scoped Mitra hierarchy and HO review access.",
        "permissions": [
            "admin.distributor_hierarchy.read",
            "admin.distributor_branches.list",
            "admin.distributor_branches.manage",
            "admin.distributor_managers.list",
            "admin.distributor_partners.list",
            "admin.distributor_partners.approve",
            "admin.distributor_promotions.manage",
        ],
    },
    "mitra_manager": {
        "name": "Mitra Manager",
        "description": "Branch manager access for the Zynd Mitra console.",
        "permissions": [
            "distributor.clients.list",
            "distributor.clients.read",
            "distributor.clients.onboard",
            "distributor.compliance.list",
            "distributor.txn_recommendations.create",
            "distributor.txn_recommendations.read",
            "distributor.partners.list",
            "distributor.partners.manage",
            "distributor.leave.review",
        ],
    },
    "mitra": {
        "name": "Mitra",
        "description": "Field Zynd Mitra access to client profiles in the distributor console.",
        "permissions": [
            "distributor.clients.list",
            "distributor.clients.read",
            "distributor.clients.onboard",
            "distributor.compliance.list",
            "distributor.txn_recommendations.create",
            "distributor.txn_recommendations.read",
            "distributor.work.manage",
            "distributor.leave.apply",
            "distributor.payroll.read",
        ],
    },
}

SEEDED_ROLE_KEYS = frozenset(ROLES.keys())
PERMISSION_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]+)+$")
ROLE_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]+$")


async def _delete_admin_role_row(db: AsyncSession, role: AdminRole) -> None:
    await db.execute(delete(AdminRolePermission).where(AdminRolePermission.role_id == role.id))
    await db.execute(
        delete(AdminUserRoleAssignment).where(AdminUserRoleAssignment.role_id == role.id)
    )
    await db.delete(role)


async def _ensure_admin_user_has_role(
    db: AsyncSession,
    *,
    user_id: UUID,
    role_id: UUID,
) -> None:
    existing = await db.execute(
        select(AdminUserRoleAssignment).where(
            AdminUserRoleAssignment.user_id == user_id,
            AdminUserRoleAssignment.role_id == role_id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(AdminUserRoleAssignment(user_id=user_id, role_id=role_id))


async def _migrate_role_assignments(
    db: AsyncSession,
    *,
    old_role: AdminRole,
    new_role: AdminRole,
) -> None:
    assignments = await db.execute(
        select(AdminUserRoleAssignment).where(AdminUserRoleAssignment.role_id == old_role.id)
    )
    for assignment in assignments.scalars():
        await _ensure_admin_user_has_role(
            db,
            user_id=assignment.user_id,
            role_id=new_role.id,
        )
        await db.delete(assignment)


async def _remove_deprecated_builtin_roles(
    db: AsyncSession,
    *,
    role_rows: dict[str, AdminRole],
) -> None:
    super_admin_role = role_rows["super_admin"]

    for old_key, new_key in ROLE_KEY_MIGRATIONS.items():
        old_result = await db.execute(select(AdminRole).where(AdminRole.key == old_key))
        old_role = old_result.scalar_one_or_none()
        new_role = role_rows.get(new_key)
        if old_role is None or new_role is None:
            continue
        await _migrate_role_assignments(db, old_role=old_role, new_role=new_role)
        await _delete_admin_role_row(db, old_role)

    for role_key in REMOVED_BUILTIN_ROLE_KEYS:
        if role_key in ROLE_KEY_MIGRATIONS:
            continue
        role_result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
        role = role_result.scalar_one_or_none()
        if role is None:
            continue

        affected_users = await db.execute(
            select(AdminUserRoleAssignment.user_id).where(
                AdminUserRoleAssignment.role_id == role.id
            )
        )
        user_ids = list(affected_users.scalars())
        await _delete_admin_role_row(db, role)

        for user_id in user_ids:
            remaining = await db.execute(
                select(AdminUserRoleAssignment.id).where(
                    AdminUserRoleAssignment.user_id == user_id
                )
            )
            if remaining.scalars().first() is None:
                db.add(
                    AdminUserRoleAssignment(
                        user_id=user_id,
                        role_id=super_admin_role.id,
                    )
                )

    await db.flush()


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
        else:
            row.name = str(config["name"])
            row.description = str(config["description"])
        role_rows[role_key] = row

        desired_permission_ids = {
            permission_rows[permission_key].id for permission_key in config["permissions"]  # type: ignore[index]
        }
        existing = await db.execute(
            select(AdminRolePermission).where(AdminRolePermission.role_id == row.id)
        )
        current_rows = list(existing.scalars())
        current_permission_ids = {item.permission_id for item in current_rows}
        for permission_id in desired_permission_ids - current_permission_ids:
            db.add(AdminRolePermission(role_id=row.id, permission_id=permission_id))
        for assignment in current_rows:
            if assignment.permission_id not in desired_permission_ids:
                await db.delete(assignment)

    await _remove_deprecated_builtin_roles(db, role_rows=role_rows)

    await db.flush()

    admin_users = await db.execute(select(User).where(User.role == UserRole.admin))
    super_admin_role = role_rows["super_admin"]
    for admin_user in admin_users.scalars():
        existing_assignments = await db.execute(
            select(AdminUserRoleAssignment).where(
                AdminUserRoleAssignment.user_id == admin_user.id
            )
        )
        if existing_assignments.scalars().first() is not None:
            continue

        db.add(
            AdminUserRoleAssignment(user_id=admin_user.id, role_id=super_admin_role.id)
        )

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


async def count_active_super_admins(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.user_id == User.id)
        .join(AdminRole, AdminRole.id == AdminUserRoleAssignment.role_id)
        .where(
            User.role == UserRole.admin,
            User.status == UserStatus.active,
            AdminRole.key == SUPER_ADMIN_ROLE_KEY,
        )
    )
    return int(result.scalar_one())


async def is_sole_active_super_admin(db: AsyncSession, user_id: UUID) -> bool:
    user = await db.get(User, user_id)
    if not user or user.role != UserRole.admin or user.status != UserStatus.active:
        return False
    role_keys = await list_user_role_keys(db, user_id)
    if SUPER_ADMIN_ROLE_KEY not in role_keys:
        return False
    return await count_active_super_admins(db) <= 1


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
