"""Backward-compatible re-exports. Prefer app.application.auth.oauth_service."""

from app.application.auth.oauth_service import (
    connect_oauth_apple,
    connect_oauth_google,
    disconnect_oauth,
    list_oauth_connections,
    provider_email_matches_account as _provider_email_matches_account,
)

__all__ = [
    "connect_oauth_apple",
    "connect_oauth_google",
    "disconnect_oauth",
    "list_oauth_connections",
    "_provider_email_matches_account",
]
