from __future__ import annotations

import hashlib

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_code_service import resolve_active_referral_code
from app.application.referral.referral_errors import ReferralError
from app.core.config import get_settings
from app.infrastructure.persistence.referral_models import ReferralClick
from app.infrastructure.security.rate_limit import check_rate_limit


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    settings = get_settings()
    digest = hashlib.sha256(f"{settings.secret_key}:{ip}".encode()).hexdigest()
    return digest[:64]


def _truncate_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    trimmed = user_agent.strip()
    if not trimmed:
        return None
    return trimmed[:255]


async def record_referral_click(
    db: AsyncSession,
    *,
    code: str,
    ip: str | None,
    user_agent: str | None,
) -> ReferralClick:
    if not await check_rate_limit(f"referral-click:{ip or code}", 30, 3600):
        raise ReferralError(
            "Too many referral link requests. Try again later.",
            "rate_limited",
            429,
        )

    referral_code = await resolve_active_referral_code(db, code=code)
    if referral_code is None:
        raise ReferralError("Referral link is invalid or inactive.", "invalid_referral_code", 404)

    click = ReferralClick(
        referral_code_id=referral_code.id,
        referrer_user_id=referral_code.user_id,
        ip_hash=_hash_ip(ip),
        user_agent_snippet=_truncate_user_agent(user_agent),
    )
    db.add(click)
    await db.flush()
    return click
