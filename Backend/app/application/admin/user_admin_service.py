from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote
from uuid import UUID

from sqlalchemy import select
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
    if reason_code not in SUSPENSION_REASON_CODES:
        raise ValueError("Invalid suspension reason code.")
    if user.status == UserStatus.deleted:
        raise ValueError("Deleted accounts cannot be suspended.")
    if user.status == UserStatus.suspended:
        raise ValueError("Account is already suspended.")
    if user.id == admin.id:
        raise ValueError("You cannot suspend your own account.")

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


async def list_users(
    db: AsyncSession,
    *,
    email: str | None = None,
    status: UserStatus | None = None,
    role: UserRole | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    query = select(User).order_by(User.created_at.desc())
    if email:
        normalized = email.lower().strip()
        query = query.where(User.email.ilike(f"%{normalized}%"))
    if status:
        query = query.where(User.status == status)
    if role:
        query = query.where(User.role == role)
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
