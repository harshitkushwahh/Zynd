from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.login_security_service import evaluate_login_velocity
from app.application.security.security_config_service import get_risk_settings
from app.infrastructure.persistence.models import Device, User


@dataclass
class LoginRiskAssessment:
    score: int
    level: str
    reasons: list[str]
    action: str


def _hour_risk(now: datetime) -> tuple[int, str | None]:
    hour = now.hour
    if hour < 5 or hour >= 23:
        return 15, "unusual_login_hour"
    return 0, None


async def assess_login_risk(
    db: AsyncSession,
    *,
    user: User,
    device: Device | None,
    is_new_device: bool,
    ip: str | None,
    failed_attempt_count: int = 0,
) -> LoginRiskAssessment:
    settings = await get_risk_settings(db)
    score = 0
    reasons: list[str] = []

    if is_new_device:
        score += 25
        reasons.append("new_device")
    elif device and not device.is_trusted:
        score += 10
        reasons.append("untrusted_device")

    if failed_attempt_count >= 3:
        score += 20
        reasons.append("recent_failures")

    hour_score, hour_reason = _hour_risk(datetime.now(timezone.utc))
    if hour_reason:
        score += hour_score
        reasons.append(hour_reason)

    velocity = await evaluate_login_velocity(user.id, ip)
    if velocity:
        score += 35
        reasons.append("impossible_travel")

    if score >= settings["high_score"]:
        level = "high"
        action = settings["high_action"]
    elif score >= settings["medium_score"]:
        level = "medium"
        action = settings["medium_action"]
    else:
        level = "low"
        action = "allow"

    return LoginRiskAssessment(score=score, level=level, reasons=reasons, action=action)


def risk_metadata(assessment: LoginRiskAssessment) -> dict[str, Any]:
    return {
        "risk_score": assessment.score,
        "risk_level": assessment.level,
        "risk_reasons": assessment.reasons,
        "risk_action": assessment.action,
    }
