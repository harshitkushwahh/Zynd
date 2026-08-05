from __future__ import annotations

from typing import Any

from app.infrastructure.persistence.models import User, UserStatus


def kyc_eligibility_status(user: User) -> dict[str, Any]:
    reasons: list[str] = []
    if user.status != UserStatus.active:
        reasons.append("account_inactive")
    if not user.email_verified_at:
        reasons.append("email_not_verified")
    if not user.phone_verified_at:
        reasons.append("phone_not_verified")
    return {"eligible": not reasons, "reasons": reasons}
