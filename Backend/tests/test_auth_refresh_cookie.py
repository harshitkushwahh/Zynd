from __future__ import annotations

from starlette.requests import Request

from app.api.v1.auth.deps import get_refresh_token_from_request
from app.core.config import get_settings


def _request(*, cookies: dict[str, str], client_header: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if client_header is not None:
        headers.append((b"x-zynd-client", client_header.encode()))
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        headers.append((b"cookie", cookie_str.encode()))
    scope = {
        "type": "http",
        "headers": headers,
        "method": "POST",
        "path": "/api/v1/auth/refresh",
    }
    return Request(scope)


def test_distributor_client_uses_distributor_cookie_only() -> None:
    settings = get_settings()
    request = _request(
        cookies={
            settings.refresh_cookie_name_admin: "admin-session",
            settings.refresh_cookie_name: "legacy-web-session",
            settings.refresh_cookie_name_distributor: "distributor-session",
        },
        client_header="distributor",
    )

    token, client = get_refresh_token_from_request(request)

    assert token == "distributor-session"
    assert client == "distributor"


def test_distributor_client_ignores_admin_and_web_cookies() -> None:
    settings = get_settings()
    request = _request(
        cookies={
            settings.refresh_cookie_name_admin: "admin-session",
            settings.refresh_cookie_name: "legacy-web-session",
        },
        client_header="distributor",
    )

    token, client = get_refresh_token_from_request(request)

    assert token is None
    assert client is None


def test_admin_client_uses_admin_cookie_not_distributor_or_web() -> None:
    settings = get_settings()
    request = _request(
        cookies={
            settings.refresh_cookie_name_admin: "admin-session",
            settings.refresh_cookie_name_distributor: "distributor-session",
            settings.refresh_cookie_name: "web-session",
        },
        client_header="admin",
    )

    token, client = get_refresh_token_from_request(request)

    assert token == "admin-session"
    assert client == "admin"


def test_admin_client_ignores_distributor_cookie_when_admin_missing() -> None:
    settings = get_settings()
    request = _request(
        cookies={settings.refresh_cookie_name_distributor: "distributor-session"},
        client_header="admin",
    )

    token, client = get_refresh_token_from_request(request)

    assert token is None
    assert client is None
