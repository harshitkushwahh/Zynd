from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository


def user_to_public_dict(user: User) -> dict[str, Any]:
    from app.application.auth.account_service import fund_eligibility_status

    eligibility = fund_eligibility_status(user)
    return {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "country_code": user.country_code,
        "email_verified_at": user.email_verified_at,
        "phone_verified_at": user.phone_verified_at,
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "mfa_enrolled_at": user.mfa_enrolled_at,
        "pin_enrolled": user.pin_hash is not None,
        "pin_set_at": user.pin_set_at,
        "fund_movement_eligible": eligibility["eligible"],
        "account_status": user.status.value,
        "deletion_scheduled_at": user.deletion_scheduled_at,
        "client_id": user.client_id,
    }


def _user_repo(db: AsyncSession) -> SqlAlchemyUserRepository:
    return SqlAlchemyUserRepository(db)


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    return await _user_repo(db).get_by_id(user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await _user_repo(db).get_by_email(email)
