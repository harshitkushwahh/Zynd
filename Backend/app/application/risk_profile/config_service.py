"""Invest-facing risk profile configuration."""

from __future__ import annotations

from typing import Any

from app.application.risk_profile.constants import (
    RISK_PROFILE_DEFAULT_ATTEMPTS,
    RISK_PROFILE_TRENDS_MIN_PROFILES,
    RISK_PROFILE_UNLOCK_BONUS_ATTEMPTS,
)


def serialize_risk_profile_config() -> dict[str, Any]:
    return {
        "trends_min_profiles": RISK_PROFILE_TRENDS_MIN_PROFILES,
        "default_attempts": RISK_PROFILE_DEFAULT_ATTEMPTS,
        "unlock_bonus_attempts": RISK_PROFILE_UNLOCK_BONUS_ATTEMPTS,
    }
