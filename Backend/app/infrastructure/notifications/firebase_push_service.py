from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.application.notifications.deep_links import (
    build_notification_web_url,
    resolve_notification_deep_link_path,
)
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.notification_models import UserNotification

logger = logging.getLogger(__name__)

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
INVALID_TOKEN_ERROR_CODES = {"UNREGISTERED", "INVALID_ARGUMENT"}


class FirebasePushService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._credentials: service_account.Credentials | None = None

    def is_enabled(self) -> bool:
        return self._settings.fcm_configured

    def _ensure_credentials(self) -> service_account.Credentials | None:
        if self._credentials is not None:
            return self._credentials

        account_info = self._settings.resolved_firebase_service_account_info
        if not account_info:
            return None

        self._credentials = service_account.Credentials.from_service_account_info(
            account_info,
            scopes=[FCM_SCOPE],
        )
        return self._credentials

    def _access_token(self) -> str | None:
        credentials = self._ensure_credentials()
        if credentials is None:
            return None

        if not credentials.valid:
            credentials.refresh(GoogleAuthRequest())
        return credentials.token

    def _build_message(
        self,
        *,
        token: str,
        notification: UserNotification,
        unread_count: int,
    ) -> dict[str, Any]:
        path, settings_section = resolve_notification_deep_link_path(
            notification_type=notification.notification_type,
            category=notification.category,
        )
        deep_link = path
        if settings_section:
            deep_link = f"{path}?section={settings_section}"

        web_url = build_notification_web_url(
            frontend_url=self._settings.frontend_url,
            notification_id=str(notification.id),
            notification_type=notification.notification_type,
            category=notification.category,
            metadata=notification.metadata_json,
        )

        data = {
            "notification_id": str(notification.id),
            "notification_type": notification.notification_type,
            "category": notification.category.value,
            "title": notification.title,
            "body": notification.body,
            "unread_count": str(unread_count),
            "deep_link": deep_link,
            "web_url": web_url,
        }
        if notification.metadata_json:
            data["metadata"] = json.dumps(notification.metadata_json)

        collapse_key = str(notification.id)
        return {
            "message": {
                "token": token,
                "notification": {
                    "title": notification.title,
                    "body": notification.body,
                },
                "data": data,
                "android": {"collapse_key": collapse_key},
                "apns": {"headers": {"apns-collapse-id": collapse_key}},
                "webpush": {
                    "fcm_options": {
                        "link": web_url,
                    },
                },
            }
        }

    @staticmethod
    def _extract_error_code(payload: dict[str, Any]) -> str | None:
        error = payload.get("error")
        if not isinstance(error, dict):
            return None

        for detail in error.get("details") or []:
            if isinstance(detail, dict) and detail.get("errorCode"):
                return str(detail["errorCode"])

        status = error.get("status")
        return str(status) if status else None

    async def send_to_token(
        self,
        *,
        token: str,
        notification: UserNotification,
        unread_count: int,
    ) -> tuple[bool, str | None]:
        if not self.is_enabled():
            return False, None

        access_token = self._access_token()
        project_id = self._settings.firebase_project_id.strip()
        if not access_token or not project_id:
            return False, None

        url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
        payload = self._build_message(
            token=token,
            notification=notification,
            unread_count=unread_count,
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError:
            logger.exception("FCM request failed notification_id=%s", notification.id)
            return False, None

        if response.is_success:
            return True, None

        try:
            body = response.json()
        except ValueError:
            body = {}

        error_code = self._extract_error_code(body)
        logger.warning(
            "FCM delivery failed notification_id=%s status=%s error_code=%s",
            notification.id,
            response.status_code,
            error_code,
        )

        if error_code in INVALID_TOKEN_ERROR_CODES or response.status_code in {404, 410}:
            return False, token
        return False, None


_firebase_push_service: FirebasePushService | None = None


def get_firebase_push_service() -> FirebasePushService:
    global _firebase_push_service
    if _firebase_push_service is None:
        _firebase_push_service = FirebasePushService()
    return _firebase_push_service
