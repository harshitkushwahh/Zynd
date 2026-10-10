from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    SUPPORT_AGENT_ROLE_KEY,
    SUPPORT_LEAD_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.application.documents.client_id_service import assign_client_id
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.password_policy import validate_password_strength
from app.infrastructure.security.passwords import hash_password, verify_password

DEV_SUPPORT_AGENT_EMAIL = "support@zynd.com"
DEV_SUPPORT_LEAD_EMAIL = "support.lead@zynd.com"
DEV_SUPPORT_PASSWORD = "Zynd@1234"


async def _ensure_dev_support_user(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_key: str,
    now: datetime,
) -> dict[str, str | bool]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    created = user is None

    if user is None:
        user = User(
            email=email,
            password_hash=hash_password(DEV_SUPPORT_PASSWORD),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.admin,
            status=UserStatus.active,
            email_verified_at=now,
        )
        await assign_client_id(db, user)
        db.add(user)
        await db.flush()
    else:
        user.role = UserRole.admin
        user.status = UserStatus.active
        if user.email_verified_at is None:
            user.email_verified_at = now
        if not verify_password(user.password_hash, DEV_SUPPORT_PASSWORD):
            user.password_hash = hash_password(DEV_SUPPORT_PASSWORD)

    await set_admin_user_roles(db, user_id=user.id, role_keys=[role_key])
    return {
        "created": created,
        "email": email,
        "account_role": UserRole.admin.value,
        "team_role": role_key,
    }


async def ensure_dev_support_seed(
    db: AsyncSession,
    settings: Settings | None = None,
    *,
    force: bool = False,
) -> dict[str, object]:
    settings = settings or get_settings()
    if settings.app_env != "development" and not force:
        return {"skipped": True}

    validate_password_strength(DEV_SUPPORT_PASSWORD)
    await ensure_rbac_seed(db)

    now = datetime.now(timezone.utc)
    agent = await _ensure_dev_support_user(
        db,
        email=DEV_SUPPORT_AGENT_EMAIL,
        first_name="Support",
        last_name="Agent",
        role_key=SUPPORT_AGENT_ROLE_KEY,
        now=now,
    )
    lead = await _ensure_dev_support_user(
        db,
        email=DEV_SUPPORT_LEAD_EMAIL,
        first_name="Support",
        last_name="Lead",
        role_key=SUPPORT_LEAD_ROLE_KEY,
        now=now,
    )

    return {
        "skipped": False,
        "password": DEV_SUPPORT_PASSWORD,
        "users": [agent, lead],
    }
