from __future__ import annotations

import math

from app.application.auth.login_security_service import _haversine_km, _is_public_ip
from app.application.auth.oauth_settings_service import _provider_email_matches_account
from app.application.auth.security_alerts_service import _device_label
from app.infrastructure.persistence.models import (
    Device,
    SecurityReviewReason,
    SecurityReviewStatus,
    User,
    UserRole,
)


def _user(email: str = "user@example.com") -> User:
    return User(email=email, role=UserRole.user)


def test_provider_email_matches_account() -> None:
    user = _user("Person@Example.com")
    assert _provider_email_matches_account(user, "person@example.com")
    assert not _provider_email_matches_account(user, "other@example.com")
    assert not _provider_email_matches_account(user, None)


def test_is_public_ip() -> None:
    assert not _is_public_ip("127.0.0.1")
    assert not _is_public_ip("192.168.1.4")
    assert _is_public_ip("8.8.8.8")


def test_haversine_distance() -> None:
    distance = _haversine_km(19.076, 72.8777, 28.6139, 77.209)
    assert 1000 < distance < 1300


def test_impossible_travel_threshold() -> None:
    distance_km = 1150.0
    elapsed_minutes = 8
    speed_kmh = distance_km / (elapsed_minutes / 60)
    assert speed_kmh > 900
    assert math.isclose(speed_kmh, 8625, rel_tol=0.05)


def test_device_label() -> None:
    device = Device(os="macOS", browser="Chrome")
    assert _device_label(device) == "macOS · Chrome"
    assert _device_label(Device()) == "Unknown device"


def test_security_review_enums() -> None:
    assert SecurityReviewStatus.open.value == "open"
    assert SecurityReviewReason.login_velocity_flagged.value == "login_velocity_flagged"
