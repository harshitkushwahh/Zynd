from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote
from uuid import UUID

from sqlalchemy import case, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.session_service import revoke_all_sessions
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.infrastructure.notifications.email_service import send_security_email
from app.infrastructure.persistence.mf_transaction_models import (
    MfExternalHolding,
    MfOrder,
    MfOrderStatus,
)
from app.infrastructure.persistence.models import (
    AdminUserRoleAssignment,
    AuditEventType,
    AuditLog,
    KycOverallStatus,
    User,
    UserKycStatus,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password

SUSPENSION_REASON_CODES = {
    "suspicious_activity",
    "kyc_mismatch",
    "user_requested",
    "compliance_hold",
    "repeated_auth_failures",
    "chargeback_dispute",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _display_name(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and part.strip())
    if name:
        return name
    local = user.email.split("@", 1)[0]
    return local.replace(".", " ").replace("_", " ").title()


async def _invested_user_ids(db: AsyncSession, user_ids: list[UUID]) -> set[UUID]:
    if not user_ids:
        return set()

    order_rows = await db.execute(
        select(MfOrder.user_id)
        .where(
            MfOrder.user_id.in_(user_ids),
            MfOrder.status == MfOrderStatus.succeeded,
        )
        .distinct()
    )
    holding_rows = await db.execute(
        select(MfExternalHolding.user_id)
        .where(MfExternalHolding.user_id.in_(user_ids))
        .distinct()
    )
    return set(order_rows.scalars()) | set(holding_rows.scalars())


async def _kyc_compliant_user_ids(db: AsyncSession, user_ids: list[UUID]) -> set[UUID]:
    if not user_ids:
        return set()

    rows = await db.execute(
        select(UserKycStatus.user_id).where(
            UserKycStatus.user_id.in_(user_ids),
            UserKycStatus.overall_status == KycOverallStatus.completed,
        )
    )
    return set(rows.scalars())


async def _kyc_onboarding_complete_user_ids(db: AsyncSession, user_ids: list[UUID]) -> set[UUID]:
    """Investors whose KYC was submitted or fully verified — mitra onboarding is done."""
    if not user_ids:
        return set()

    rows = await db.execute(
        select(UserKycStatus.user_id).where(
            UserKycStatus.user_id.in_(user_ids),
            UserKycStatus.overall_status.in_(
                (KycOverallStatus.submitted, KycOverallStatus.completed),
            ),
        )
    )
    return set(rows.scalars())


ZYND_ID_SUFFIX = "@zynd"


def user_path_ref(user: User) -> str:
    client_id = (user.client_id or "").strip()
    if client_id.endswith(ZYND_ID_SUFFIX):
        return client_id[: -len(ZYND_ID_SUFFIX)]
    if client_id:
        return client_id
    return str(user.id)


def user_identity_fields(user: User) -> dict[str, Any]:
    return {
        "user_id": user.id,
        "client_id": user.client_id or "",
        "user_ref": user_path_ref(user),
    }


async def get_user_by_reference(db: AsyncSession, reference: str) -> User | None:
    """Resolve a user by UUID or Zynd client_id."""
    normalized = unquote(reference).strip()
    if not normalized:
        return None

    try:
        user_id = UUID(normalized)
    except ValueError:
        user_id = None
    if user_id is not None:
        user = await db.get(User, user_id)
        if user:
            return user

    client_id_candidates: list[str] = [normalized]
    if "%40" in normalized:
        client_id_candidates.append(normalized.replace("%40", "@"))
    if "@" not in normalized:
        client_id_candidates.append(f"{normalized}@zynd")

    seen: set[str] = set()
    for client_id in client_id_candidates:
        if client_id in seen:
            continue
        seen.add(client_id)
        result = await db.execute(select(User).where(User.client_id == client_id))
        user = result.scalar_one_or_none()
        if user:
            return user
    return None


async def suspend_user(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    reason_code: str,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import (
        SUPER_ADMIN_ROLE_KEY,
        count_active_super_admins,
        list_user_role_keys,
        user_has_permission,
    )

    if reason_code not in SUSPENSION_REASON_CODES:
        raise ValueError("Invalid suspension reason code.")
    if user.status == UserStatus.deleted:
        raise ValueError("Deleted accounts cannot be suspended.")
    if user.status == UserStatus.suspended:
        raise ValueError("Account is already suspended.")
    if user.id == admin.id:
        raise ValueError("You cannot suspend your own account.")

    if user.role == UserRole.admin:
        if not await user_has_permission(db, admin.id, "admin.accounts.manage"):
            raise ValueError("Only super admins can suspend admin accounts.")
        target_roles = await list_user_role_keys(db, user.id)
        if SUPER_ADMIN_ROLE_KEY in target_roles:
            if await count_active_super_admins(db) <= 1 and user.status == UserStatus.active:
                raise ValueError("Cannot suspend the last active super admin.")
        if user.status == UserStatus.deletion_pending:
            raise ValueError(
                "This admin account is in the customer deletion queue. "
                "Cancel deletion scheduling before changing access."
            )
    elif user.status == UserStatus.deletion_pending:
        raise ValueError("Accounts pending deletion cannot be suspended.")

    user.status = UserStatus.suspended
    user.suspended_at = _now()
    user.suspension_reason_code = reason_code
    user.suspended_by = admin.id
    user.is_locked = False
    user.locked_until = None

    revoked = await revoke_all_sessions(db, user_id=user.id, ip=ip, reason="account_suspended")
    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.account_suspended,
            ip_address=ip,
            metadata_={
                "reason_code": reason_code,
                "admin_id": str(admin.id),
                "notes": notes,
                "revoked_sessions": revoked,
            },
        )
    )

    if user.email and not user.email.startswith("deleted+"):
        await send_security_email(
            to_email=user.email,
            subject="Your ZYND account has been suspended",
            body=(
                "Your ZYND account has been temporarily suspended.\n\n"
                "If you believe this is a mistake, contact support to appeal."
            ),
        )

    await db.flush()
    return {
        "user_id": str(user.id),
        "status": user.status.value,
        "suspension_reason_code": reason_code,
        "suspended_at": user.suspended_at,
    }


async def unsuspend_user(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if user.role == UserRole.admin:
        from app.application.admin.rbac_service import user_has_permission

        if not await user_has_permission(db, admin.id, "admin.accounts.manage"):
            raise ValueError("Only super admins can restore admin account access.")

    if user.status != UserStatus.suspended:
        raise ValueError("Account is not suspended.")

    user.status = UserStatus.active
    user.suspended_at = None
    user.suspension_reason_code = None
    user.suspended_by = None

    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.account_unsuspended,
            ip_address=ip,
            metadata_={"admin_id": str(admin.id), "notes": notes},
        )
    )

    if user.email and not user.email.startswith("deleted+"):
        await send_security_email(
            to_email=user.email,
            subject="Your ZYND account has been reactivated",
            body="Your ZYND account suspension has been lifted. You can sign in again.",
        )

    await db.flush()
    return {
        "user_id": str(user.id),
        "status": user.status.value,
    }


async def list_admin_accounts(db: AsyncSession) -> list[dict[str, Any]]:
    from app.application.admin.rbac_service import list_user_role_keys

    result = await db.execute(
        select(User)
        .where(
            User.role == UserRole.admin,
            User.status != UserStatus.deleted,
        )
        .order_by(User.email.asc())
    )
    items: list[dict[str, Any]] = []
    for user in result.scalars():
        items.append(
            {
                **user_identity_fields(user),
                "email": user.email,
                "display_name": _display_name(user),
                "status": user.status.value,
                "roles": sorted(await list_user_role_keys(db, user.id)),
                "mfa_enrolled": user.mfa_enrolled_at is not None,
                "suspended_at": user.suspended_at,
                "suspension_reason_code": user.suspension_reason_code,
                "deletion_requested_at": user.deletion_requested_at,
                "deletion_scheduled_at": user.deletion_scheduled_at,
                "created_at": user.created_at,
            }
        )
    return items


async def count_admin_accounts_on_hold(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.role == UserRole.admin,
            User.status == UserStatus.suspended,
        )
    )
    return int(result.scalar_one())


async def cancel_admin_deletion_schedule(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import user_has_permission
    from app.application.auth.account_service import cancel_account_deletion

    if user.role != UserRole.admin:
        raise ValueError("Only admin accounts can be managed through this workflow.")
    if not await user_has_permission(db, admin.id, "admin.accounts.manage"):
        raise ValueError("Only super admins can cancel admin deletion scheduling.")
    if user.status != UserStatus.deletion_pending:
        raise ValueError("No pending deletion request for this admin account.")

    await cancel_account_deletion(db, user=user, ip=ip)
    await db.flush()
    return {"user_id": str(user.id), "status": user.status.value}


async def hold_admin_account_access(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if user.role != UserRole.admin:
        raise ValueError("Target is not an admin account.")
    return await suspend_user(
        db,
        user=user,
        admin=admin,
        reason_code="compliance_hold",
        ip=ip,
        notes=notes,
    )


async def restore_admin_account_access(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if user.role != UserRole.admin:
        raise ValueError("Target is not an admin account.")
    return await unsuspend_user(
        db,
        user=user,
        admin=admin,
        ip=ip,
        notes=notes or "Restore admin console access",
    )


async def remove_admin_account(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import user_has_permission
    from app.application.compliance.anonymization import anonymize_user_profile
    from app.application.compliance.deletion_executor_service import _purge_auth_credentials
    from app.infrastructure.persistence.distributor_branch_models import DistributorBranch

    if user.role != UserRole.admin:
        raise ValueError("Target is not an admin account.")
    if not await user_has_permission(db, admin.id, "admin.accounts.manage"):
        raise ValueError("Only super admins can remove admin accounts.")
    if user.id == admin.id:
        raise ValueError("You cannot remove your own admin account.")
    if user.status == UserStatus.deleted:
        raise ValueError("Admin account is already removed.")
    if user.status != UserStatus.suspended:
        raise ValueError("Suspend the admin account before removing it from the system.")

    original_email = user.email
    original_client_id = user.client_id
    removed_at = _now()

    await db.execute(
        update(DistributorBranch)
        .where(DistributorBranch.manager_user_id == user.id)
        .values(manager_user_id=None, updated_at=removed_at)
    )
    await _purge_auth_credentials(db, user.id)
    await db.execute(
        delete(AdminUserRoleAssignment).where(AdminUserRoleAssignment.user_id == user.id)
    )

    anonymize_user_profile(user)
    user.status = UserStatus.deleted
    user.deleted_at = removed_at
    user.suspended_at = None
    user.suspension_reason_code = None
    user.suspended_by = None
    user.deletion_requested_at = None
    user.deletion_scheduled_at = None

    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.admin_account_removed,
            ip_address=ip,
            metadata_={
                "admin_id": str(admin.id),
                "notes": notes,
                "original_email": original_email,
                "original_client_id": original_client_id,
                "removed_at": removed_at.isoformat(),
                "outcome": "removed_successfully",
            },
        )
    )

    await db.flush()
    return {
        "user_id": str(user.id),
        "status": user.status.value,
        "removed_at": removed_at,
    }


async def get_user_directory_metrics(db: AsyncSession) -> dict[str, int]:
    customer_filter = User.role == UserRole.user

    registered_users = (
        await db.execute(select(func.count()).select_from(User).where(customer_filter))
    ).scalar_one()
    suspended_accounts = (
        await db.execute(
            select(func.count()).select_from(User).where(
                customer_filter,
                User.status == UserStatus.suspended,
            )
        )
    ).scalar_one()
    kyc_compliant = (
        await db.execute(
            select(func.count())
            .select_from(UserKycStatus)
            .join(User, User.id == UserKycStatus.user_id)
            .where(
                customer_filter,
                UserKycStatus.overall_status == KycOverallStatus.completed,
            )
        )
    ).scalar_one()
    invested_order_users = (
        select(MfOrder.user_id)
        .where(MfOrder.status == MfOrderStatus.succeeded)
        .distinct()
    )
    invested_holding_users = select(MfExternalHolding.user_id).distinct()
    active_investors = (
        await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                customer_filter,
                or_(
                    User.id.in_(invested_order_users),
                    User.id.in_(invested_holding_users),
                ),
            )
        )
    ).scalar_one()

    return {
        "registered_users": int(registered_users),
        "kyc_compliant": int(kyc_compliant),
        "suspended_accounts": int(suspended_accounts),
        "active_investors": int(active_investors),
    }


async def list_users(
    db: AsyncSession,
    *,
    email: str | None = None,
    status: UserStatus | None = None,
    role: UserRole | None = None,
    user_ids: list[UUID] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    deleted_last = case((User.status == UserStatus.deleted, 1), else_=0)
    query = select(User).order_by(deleted_last.asc(), User.created_at.desc())
    if email:
        normalized = email.lower().strip()
        query = query.where(User.email.ilike(f"%{normalized}%"))
    if status:
        query = query.where(User.status == status)
    if role:
        query = query.where(User.role == role)
    if user_ids is not None:
        if not user_ids:
            return []
        query = query.where(User.id.in_(user_ids))
    query = query.limit(min(limit, 100)).offset(max(offset, 0))
    result = await db.execute(query)
    users = list(result.scalars())
    user_ids = [user.id for user in users]
    invested_ids = await _invested_user_ids(db, user_ids)
    kyc_compliant_ids = await _kyc_compliant_user_ids(db, user_ids)
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    return [
        {
            "user_id": user.id,
            "client_id": user.client_id,
            "email": user.email,
            "display_name": _display_name(user),
            "profile_image_url": profile_images.get(user.id),
            "status": user.status.value,
            "role": user.role.value,
            "has_invested": user.id in invested_ids,
            "kyc_compliant": user.id in kyc_compliant_ids,
            "suspended_at": user.suspended_at,
            "mfa_enrolled": user.mfa_enrolled_at is not None,
            "created_at": user.created_at,
        }
        for user in users
    ]


def _user_summary_dict(
    user: User,
    *,
    has_invested: bool,
    profile_image_url: str | None = None,
) -> dict[str, Any]:
    return {
        "user_id": user.id,
        "client_id": user.client_id,
        "email": user.email,
        "display_name": _display_name(user),
        "phone": user.phone,
        "profile_image_url": profile_image_url,
        "status": user.status.value,
        "role": user.role.value,
        "has_invested": has_invested,
        "suspended_at": user.suspended_at,
        "suspension_reason_code": user.suspension_reason_code,
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "created_at": user.created_at,
    }


async def get_user_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    from app.application.admin.user_security_summary_service import (
        build_admin_security_summary,
        get_user_last_login_summary,
    )

    user = await db.get(User, user_id)
    if not user:
        return None
    invested_ids = await _invested_user_ids(db, [user.id])
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=[user.id])
    last_login = await get_user_last_login_summary(db, user.id)
    security = build_admin_security_summary(user, last_login)
    return {
        **_user_summary_dict(
            user,
            has_invested=user.id in invested_ids,
            profile_image_url=profile_images.get(user.id),
        ),
        **security,
    }


async def get_user_summary_by_reference(db: AsyncSession, reference: str) -> dict[str, Any] | None:
    from app.application.admin.user_security_summary_service import (
        build_admin_security_summary,
        get_user_last_login_summary,
    )

    user = await get_user_by_reference(db, reference)
    if not user:
        return None
    invested_ids = await _invested_user_ids(db, [user.id])
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=[user.id])
    last_login = await get_user_last_login_summary(db, user.id)
    security = build_admin_security_summary(user, last_login)
    return {
        **_user_summary_dict(
            user,
            has_invested=user.id in invested_ids,
            profile_image_url=profile_images.get(user.id),
        ),
        **security,
    }


async def create_admin_user(
    db: AsyncSession,
    *,
    actor: User,
    email: str,
    first_name: str,
    last_name: str | None,
    password: str,
    role_keys: list[str],
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import assign_role_to_admin_user

    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("Email is required.")
    if not first_name.strip():
        raise ValueError("First name is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not role_keys:
        raise ValueError("At least one team role is required.")

    unique_role_keys = list(dict.fromkeys(role_keys))

    existing = await db.execute(select(User).where(User.email == normalized_email))
    existing_user = existing.scalar_one_or_none()
    if existing_user:
        if existing_user.role == UserRole.user:
            raise ValueError(
                "This email is already used by a customer account. "
                "Admin accounts must use a separate email."
            )
        raise ValueError("An admin account with this email already exists.")

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        first_name=first_name.strip(),
        last_name=last_name.strip() if last_name else None,
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=_now(),
    )
    await assign_client_id(db, user)
    db.add(user)
    await db.flush()

    assigned_roles: list[str] = []
    for role_key in unique_role_keys:
        assigned_roles = await assign_role_to_admin_user(
            db,
            user_id=user.id,
            role_key=role_key,
        )

    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "admin_user_created",
                "actor_id": str(actor.id),
                "role_keys": unique_role_keys,
            },
        )
    )
    await db.flush()

    invested_ids = await _invested_user_ids(db, [user.id])
    summary = _user_summary_dict(user, has_invested=user.id in invested_ids)
    summary["roles"] = assigned_roles
    return summary
