from __future__ import annotations

from typing import Any

from app.application.auth.mfa_service import user_has_mfa
from app.application.auth.pin_service import user_has_pin
from app.infrastructure.persistence.models import User, UserStatus


def kyc_eligibility_status(user: User) -> dict[str, Any]:
    reasons: list[str] = []
    if user.status != UserStatus.active:
        reasons.append("account_inactive")
    if not user.email_verified_at:
        reasons.append("email_not_verified")
    if not user.phone_verified_at:
        reasons.append("phone_not_verified")
    if user.mfa_required_for_funds and not user_has_mfa(user):
        reasons.append("mfa_required")
    if user.mfa_required_for_funds and user_has_mfa(user) and not user_has_pin(user):
        reasons.append("pin_required")
    return {"eligible": not reasons, "reasons": reasons}
