from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.application.documents.client_id_service import assign_client_id
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password, verify_password

DEV_ADMIN_EMAIL = "admin@zynd.com"
DEV_ADMIN_PASSWORD = "12345678"
DEV_SUPER_ADMIN_ROLE_KEY = "super_admin"


async def ensure_dev_admin_seed(
    db: AsyncSession,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    if settings.app_env != "development":
        return

    await ensure_rbac_seed(db)

    now = datetime.now(timezone.utc)
    result = await db.execute(select(User).where(User.email == DEV_ADMIN_EMAIL))
    admin = result.scalar_one_or_none()

    if admin is None:
        admin = User(
            email=DEV_ADMIN_EMAIL,
            password_hash=hash_password(DEV_ADMIN_PASSWORD),
            first_name="Admin",
            last_name="User",
            role=UserRole.admin,
            status=UserStatus.active,
            email_verified_at=now,
        )
        await assign_client_id(db, admin)
        db.add(admin)
        await db.flush()
    else:
        admin.role = UserRole.admin
        admin.status = UserStatus.active
        if admin.email_verified_at is None:
            admin.email_verified_at = now
        if not verify_password(admin.password_hash, DEV_ADMIN_PASSWORD):
            admin.password_hash = hash_password(DEV_ADMIN_PASSWORD)

    await set_admin_user_roles(db, user_id=admin.id, role_keys=[DEV_SUPER_ADMIN_ROLE_KEY])
