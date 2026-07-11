"""Backward-compatible re-exports. Prefer app.application.auth.oauth_service."""

from app.application.auth.oauth_service import (
    OAuthStatePurpose,
    consume_oauth_state,
    create_oauth_state,
    require_oauth_state,
)

__all__ = [
    "OAuthStatePurpose",
    "consume_oauth_state",
    "create_oauth_state",
    "require_oauth_state",
]
