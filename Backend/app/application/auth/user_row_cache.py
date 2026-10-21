from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_cache_invalidation import USER_ROW_PREFIX
from app.application.shared.redis_json_cache import get_json, set_json
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository


def _serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "phone": user.phone,
        "password_hash": user.password_hash,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "country_code": user.country_code,
        "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        "phone_verified_at": user.phone_verified_at.isoformat() if user.phone_verified_at else None,
        "is_locked": user.is_locked,
        "failed_login_count": user.failed_login_count,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "mfa_enrolled_at": user.mfa_enrolled_at.isoformat() if user.mfa_enrolled_at else None,
        "mfa_required_for_funds": user.mfa_required_for_funds,
        "status": user.status.value,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "deletion_requested_at": user.deletion_requested_at.isoformat() if user.deletion_requested_at else None,
        "deletion_scheduled_at": user.deletion_scheduled_at.isoformat() if user.deletion_scheduled_at else None,
        "suspended_at": user.suspended_at.isoformat() if user.suspended_at else None,
        "suspension_reason_code": user.suspension_reason_code,
        "suspended_by": str(user.suspended_by) if user.suspended_by else None,
        "password_changed_at": user.password_changed_at.isoformat() if user.password_changed_at else None,
        "email_changed_at": user.email_changed_at.isoformat() if user.email_changed_at else None,
        "pin_hash": user.pin_hash,
        "pin_set_at": user.pin_set_at.isoformat() if user.pin_set_at else None,
        "pin_failed_attempts": user.pin_failed_attempts,
        "pin_locked_until": user.pin_locked_until.isoformat() if user.pin_locked_until else None,
        "client_id": user.client_id,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _deserialize_user(data: dict[str, Any]) -> User:
    return User(
        id=UUID(data["id"]),
        email=data["email"],
        phone=data.get("phone"),
        password_hash=data.get("password_hash"),
        first_name=data.get("first_name"),
        middle_name=data.get("middle_name"),
        last_name=data.get("last_name"),
        role=UserRole(data["role"]),
        country_code=data.get("country_code") or "IN",
        email_verified_at=_parse_dt(data.get("email_verified_at")),
        phone_verified_at=_parse_dt(data.get("phone_verified_at")),
        is_locked=bool(data.get("is_locked")),
        failed_login_count=int(data.get("failed_login_count") or 0),
        locked_until=_parse_dt(data.get("locked_until")),
        mfa_enrolled_at=_parse_dt(data.get("mfa_enrolled_at")),
        mfa_required_for_funds=bool(data.get("mfa_required_for_funds", True)),
        status=UserStatus(data["status"]),
        deleted_at=_parse_dt(data.get("deleted_at")),
        deletion_requested_at=_parse_dt(data.get("deletion_requested_at")),
        deletion_scheduled_at=_parse_dt(data.get("deletion_scheduled_at")),
        suspended_at=_parse_dt(data.get("suspended_at")),
        suspension_reason_code=data.get("suspension_reason_code"),
        suspended_by=UUID(data["suspended_by"]) if data.get("suspended_by") else None,
        password_changed_at=_parse_dt(data.get("password_changed_at")),
        email_changed_at=_parse_dt(data.get("email_changed_at")),
        pin_hash=data.get("pin_hash"),
        pin_set_at=_parse_dt(data.get("pin_set_at")),
        pin_failed_attempts=int(data.get("pin_failed_attempts") or 0),
        pin_locked_until=_parse_dt(data.get("pin_locked_until")),
        client_id=data["client_id"],
        created_at=_parse_dt(data.get("created_at")),
        updated_at=_parse_dt(data.get("updated_at")),
    )


async def get_user_by_id_cached(db: AsyncSession, user_id: UUID) -> User | None:
    settings = get_settings()
    key = f"{USER_ROW_PREFIX}{user_id}"
    if settings.auth_user_row_cache_enabled:
        cached = await get_json(key, settings=settings)
        if isinstance(cached, dict) and cached.get("id"):
            merged = await db.merge(_deserialize_user(cached))
            return merged

    user = await SqlAlchemyUserRepository(db).get_by_id(user_id)
    if user is None:
        return None
    if settings.auth_user_row_cache_enabled:
        await set_json(
            key,
            _serialize_user(user),
            ttl_seconds=settings.auth_user_row_cache_ttl_seconds,
            jitter_seconds=settings.auth_user_row_cache_jitter_seconds,
            settings=settings,
        )
    return user
