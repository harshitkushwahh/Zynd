from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.application.documents.client_id_service import assign_client_id
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password

DEV_DISTRIBUTOR_EMAIL = "distributor@zynd.com"
DEV_DISTRIBUTOR_PASSWORD = "12345678"


async def ensure_dev_distributor_seed(
    db: AsyncSession,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    if settings.app_env != "development":
        return

    await ensure_rbac_seed(db)

    result = await db.execute(select(User).where(User.email == DEV_DISTRIBUTOR_EMAIL))
    existing = result.scalar_one_or_none()
    if existing is not None:
        return

    now = datetime.now(timezone.utc)
    distributor = User(
        email=DEV_DISTRIBUTOR_EMAIL,
        password_hash=hash_password(DEV_DISTRIBUTOR_PASSWORD),
        first_name="Distributor",
        last_name="Console",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    await assign_client_id(db, distributor)
    db.add(distributor)
    await db.flush()
    await set_admin_user_roles(db, user_id=distributor.id, role_keys=["distributor_console"])
