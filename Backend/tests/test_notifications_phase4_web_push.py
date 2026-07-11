from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.application.notifications.deep_links import (
    build_notification_web_url,
    resolve_notification_deep_link_path,
)
from app.infrastructure.notifications.firebase_push_service import FirebasePushService
from app.infrastructure.persistence.notification_models import NotificationCategory, UserNotification


def test_resolve_notification_deep_link_path_kyc() -> None:
    path, section = resolve_notification_deep_link_path(
        notification_type="kyc.completed",
        category=NotificationCategory.kyc,
    )
    assert path == "/dashboard/kyc"
    assert section is None


def test_resolve_notification_deep_link_path_security_with_section() -> None:
    path, section = resolve_notification_deep_link_path(
        notification_type="auth.login.succeeded",
        category=NotificationCategory.security,
    )
    assert path == "/dashboard/settings"
    assert section == "security"


def test_build_notification_web_url_includes_deep_link_query() -> None:
    url = build_notification_web_url(
        frontend_url="https://app.zynd.test",
        notification_id="abc-123",
        notification_type="auth.login.succeeded",
        category=NotificationCategory.security,
    )
    assert url.startswith("https://app.zynd.test/dashboard/settings?")
    assert "notification_id=abc-123" in url
    assert "notification_type=auth.login.succeeded" in url
    assert "section=security" in url


def test_firebase_push_message_includes_web_url_and_deep_link() -> None:
    service = FirebasePushService()
    notification = UserNotification(
        id=uuid4(),
        user_id=uuid4(),
        category=NotificationCategory.kyc,
        notification_type="kyc.completed",
        title="KYC complete",
        body="Your KYC is approved",
        metadata_json={"status": "approved"},
        idempotency_key=None,
        read_at=None,
        created_at=datetime.now(UTC),
    )

    message = service._build_message(
        token="fcm-token",
        notification=notification,
        unread_count=3,
    )

    data = message["message"]["data"]
    assert data["deep_link"] == "/dashboard/kyc"
    assert data["web_url"].startswith("http")
    assert "notification_id=" in data["web_url"]
    assert data["metadata"] == '{"status": "approved"}'
    assert message["message"]["webpush"]["fcm_options"]["link"] == data["web_url"]
