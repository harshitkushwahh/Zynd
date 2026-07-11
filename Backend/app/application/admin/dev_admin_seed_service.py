from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password

DEV_ADMIN_EMAIL = "admin@zynd.com"
DEV_ADMIN_PASSWORD = "12345678"


async def ensure_dev_admin_seed(
    db: AsyncSession,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    if settings.app_env != "development":
        return

    result = await db.execute(select(User).where(User.email == DEV_ADMIN_EMAIL))
    if result.scalar_one_or_none() is not None:
        return

    now = datetime.now(timezone.utc)
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
