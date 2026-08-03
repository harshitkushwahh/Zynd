from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.mfa_service import user_has_mfa
from app.application.auth.pin_service import user_has_pin
from app.application.security.security_config_service import (
    get_fund_movement_policy,
    get_second_factor_policy,
)
from app.infrastructure.persistence.models import User

FundEligibilityNextAction = Literal[
    "verify_email",
    "verify_phone",
    "setup_mfa",
    "setup_pin",
]


def resolve_fund_eligibility_next_action(
    reasons: list[str],
) -> FundEligibilityNextAction | None:
    if "email_verification_required" in reasons:
        return "verify_email"
    if "phone_verification_required" in reasons:
        return "verify_phone"
    if "mfa_required" in reasons:
        return "setup_mfa"
    if "pin_required" in reasons:
        return "setup_pin"
    return None


def evaluate_fund_eligibility_with_policy(
    user: User,
    *,
    require_mfa: bool,
    require_pin: bool,
) -> dict[str, Any]:
    from app.infrastructure.persistence.models import UserStatus

    reasons: list[str] = []
    if user.status != UserStatus.active:
        reasons.append("account_inactive")

    if not user.email_verified_at:
        reasons.append("email_verification_required")
    if not user.phone_verified_at or not user.phone:
        reasons.append("phone_verification_required")

    mfa_gate_active = require_mfa and user.mfa_required_for_funds
    if mfa_gate_active and not user_has_mfa(user):
        reasons.append("mfa_required")
    if (
        require_pin
        and mfa_gate_active
        and user_has_mfa(user)
        and not user_has_pin(user)
    ):
        reasons.append("pin_required")

    return {
        "eligible": not reasons,
        "reasons": reasons,
        "next_action": resolve_fund_eligibility_next_action(reasons),
        "email_verified": user.email_verified_at is not None,
        "mfa_enrolled": user_has_mfa(user),
        "pin_enrolled": user_has_pin(user),
        "phone_verified": user.phone_verified_at is not None,
    }


async def evaluate_fund_eligibility(db: AsyncSession, user: User) -> dict[str, Any]:
    fund_policy = await get_fund_movement_policy(db)
    return evaluate_fund_eligibility_with_policy(
        user,
        require_mfa=fund_policy["require_mfa"],
        require_pin=fund_policy["require_pin"],
    )


async def get_auth_security_policy(db: AsyncSession, user: User) -> dict[str, Any]:
    second_factor = await get_second_factor_policy(db)
    fund_policy = await get_fund_movement_policy(db)

    fund_require_mfa = fund_policy["require_mfa"] and user.mfa_required_for_funds
    fund_require_pin = fund_policy["require_pin"]

    return {
        **second_factor,
        "fund_require_mfa": fund_require_mfa,
        "fund_require_pin": fund_require_pin,
        "mfa_enrolled": user_has_mfa(user),
        "pin_enrolled": user_has_pin(user),
        "phone_verified": user.phone_verified_at is not None,
    }
