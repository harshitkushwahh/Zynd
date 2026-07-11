from __future__ import annotations

import re
import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralCode

_REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_REFERRAL_CODE_LENGTH = 8
_REFERRAL_CODE_PATTERN = re.compile(r"^[A-Z0-9]{6,16}$")


def normalize_referral_code(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().upper()
    if not _REFERRAL_CODE_PATTERN.fullmatch(normalized):
        return None
    return normalized


def _generate_referral_code_candidate() -> str:
    return "".join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(_REFERRAL_CODE_LENGTH))


async def resolve_active_referral_code(
    db: AsyncSession,
    *,
    code: str,
) -> ReferralCode | None:
    normalized = normalize_referral_code(code)
    if not normalized:
        return None
    result = await db.execute(
        select(ReferralCode).where(
            ReferralCode.code == normalized,
            ReferralCode.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def get_referral_code_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> ReferralCode | None:
    result = await db.execute(select(ReferralCode).where(ReferralCode.user_id == user_id))
    return result.scalar_one_or_none()


async def get_or_create_referral_code(
    db: AsyncSession,
    *,
    user: User,
) -> ReferralCode:
    existing = await get_referral_code_for_user(db, user_id=user.id)
    if existing:
        return existing

    attempt = 0
    while attempt < 20:
        candidate = _generate_referral_code_candidate()
        collision = await db.execute(
            select(ReferralCode.id).where(ReferralCode.code == candidate).limit(1)
        )
        if collision.scalar_one_or_none() is not None:
            attempt += 1
            continue
        row = ReferralCode(user_id=user.id, code=candidate, is_active=True)
        db.add(row)
        await db.flush()
        return row

    raise RuntimeError("Could not allocate a unique referral code")


async def count_referral_clicks_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    from app.infrastructure.persistence.referral_models import ReferralClick

    result = await db.execute(
        select(func.count()).select_from(ReferralClick).where(ReferralClick.referrer_user_id == user_id)
    )
    return int(result.scalar_one())
