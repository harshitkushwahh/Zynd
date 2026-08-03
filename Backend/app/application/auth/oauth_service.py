from __future__ import annotations

import hashlib
import logging
import secrets
from typing import Any, Literal
from uuid import UUID

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.errors import AuthError
from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import AuditEventType, OAuthAccount, OAuthProvider, User
from app.infrastructure.security.apple_oauth import verify_apple_identity_token

logger = logging.getLogger(__name__)

OAuthStatePurpose = Literal[
    "google_login",
    "apple_login",
    "google_connect",
    "apple_connect",
    "oauth_link",
]


def _hash_state(state: str) -> str:
    return hashlib.sha256(state.encode()).hexdigest()


async def create_oauth_state(purpose: OAuthStatePurpose, *, ttl_seconds: int = 600) -> str:
    settings = get_settings()
    state = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"oauth_state:{_hash_state(state)}", ttl_seconds, purpose)
    return state


async def consume_oauth_state(state: str, expected_purpose: OAuthStatePurpose) -> bool:
    if not state:
        return False
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = f"oauth_state:{_hash_state(state)}"
    purpose = await redis.get(key)
    if not purpose or purpose != expected_purpose:
        return False
    await redis.delete(key)
    return True


async def require_oauth_state(
    state: str | None,
    expected_purpose: OAuthStatePurpose,
    *,
    required_in_production: bool = True,
) -> None:
    settings = get_settings()
    if not state:
        if required_in_production and settings.app_env == "production":
            raise AuthError("Missing OAuth state.", "oauth_state_required", 400)
        return

    if not await consume_oauth_state(state, expected_purpose):
        raise AuthError("Invalid or expired OAuth state.", "oauth_state_invalid", 400)


def provider_email_matches_account(user: User, provider_email: str | None) -> bool:
    if not provider_email:
        return False
    return provider_email.lower().strip() == user.email.lower().strip()


async def _audit_oauth(
    db: AsyncSession,
    *,
    event_type: AuditEventType,
    user_id: UUID,
    ip: str | None,
    provider: OAuthProvider,
) -> None:
    await write_audit(
        db,
        event_type=event_type,
        user_id=user_id,
        ip=ip,
        metadata={"provider": provider.value},
    )


def _connection_status(account: OAuthAccount | None) -> dict[str, Any]:
    return {
        "connected": account is not None,
        "email": account.email if account else None,
    }


async def list_oauth_connections(db: AsyncSession, user: User) -> dict[str, Any]:
    result = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == user.id))
    accounts = {account.provider: account for account in result.scalars()}
    return {
        "google": _connection_status(accounts.get(OAuthProvider.google)),
        "apple": _connection_status(accounts.get(OAuthProvider.apple)),
    }


async def _ensure_provider_available(
    db: AsyncSession,
    *,
    provider: OAuthProvider,
    provider_user_id: str,
    user_id: UUID,
) -> None:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing and existing.user_id != user_id:
        raise AuthError(
            "This provider account is already linked to another user.",
            "oauth_exists",
            409,
        )


async def _ensure_not_connected(db: AsyncSession, *, user_id: UUID, provider: OAuthProvider) -> None:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.user_id == user_id,
            OAuthAccount.provider == provider,
        )
    )
    if result.scalar_one_or_none():
        raise AuthError(
            f"{provider.value.title()} is already connected.",
            "oauth_already_connected",
            409,
        )


async def connect_oauth_google(
    db: AsyncSession,
    *,
    user: User,
    id_token: str,
    oauth_state: str | None,
    ip: str | None,
) -> dict[str, Any]:
    await require_oauth_state(oauth_state, "google_connect", required_in_production=True)
    settings = get_settings()
    if not settings.google_client_id:
        raise AuthError("Google Sign-In is not configured.", "google_not_configured", 503)

    try:
        idinfo = google_id_token.verify_oauth2_token(
            id_token, google_requests.Request(), settings.google_client_id
        )
    except Exception as exc:
        raise AuthError("Invalid Google token.", "invalid_google_token", 401) from exc

    google_sub = idinfo["sub"]
    email = idinfo.get("email", "").lower().strip()
    if not provider_email_matches_account(user, email):
        raise AuthError(
            "Google email must match your registered account email.",
            "oauth_email_mismatch",
            400,
        )

    await _ensure_not_connected(db, user_id=user.id, provider=OAuthProvider.google)
    await _ensure_provider_available(
        db,
        provider=OAuthProvider.google,
        provider_user_id=google_sub,
        user_id=user.id,
    )

    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=OAuthProvider.google,
            provider_user_id=google_sub,
            email=email,
        )
    )
    await _audit_oauth(
        db,
        event_type=AuditEventType.oauth_connected,
        user_id=user.id,
        ip=ip,
        provider=OAuthProvider.google,
    )
    return await list_oauth_connections(db, user)


async def connect_oauth_apple(
    db: AsyncSession,
    *,
    user: User,
    id_token: str,
    user_email: str | None,
    oauth_state: str | None,
    ip: str | None,
) -> dict[str, Any]:
    await require_oauth_state(oauth_state, "apple_connect", required_in_production=True)
    settings = get_settings()
    if not settings.apple_client_id:
        raise AuthError("Apple Sign-In is not configured.", "apple_not_configured", 503)

    try:
        claims = verify_apple_identity_token(id_token, settings.apple_client_id)
    except Exception as exc:
        raise AuthError("Invalid Apple token.", "invalid_apple_token", 401) from exc

    apple_sub = claims["sub"]
    token_email = claims.get("email", "").lower().strip() or None
    email = token_email or (user_email.lower().strip() if user_email else None)

    if token_email and user_email and user_email.lower().strip() != token_email:
        raise AuthError("Apple account details do not match.", "invalid_apple_profile", 400)

    if not provider_email_matches_account(user, email):
        raise AuthError(
            "Apple email must match your registered account email.",
            "oauth_email_mismatch",
            400,
        )

    await _ensure_not_connected(db, user_id=user.id, provider=OAuthProvider.apple)
    await _ensure_provider_available(
        db,
        provider=OAuthProvider.apple,
        provider_user_id=apple_sub,
        user_id=user.id,
    )

    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=OAuthProvider.apple,
            provider_user_id=apple_sub,
            email=email,
        )
    )
    await _audit_oauth(
        db,
        event_type=AuditEventType.oauth_connected,
        user_id=user.id,
        ip=ip,
        provider=OAuthProvider.apple,
    )
    return await list_oauth_connections(db, user)


async def disconnect_oauth(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    provider: OAuthProvider,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, Any]:
    from app.application.auth.account_service import verify_step_up

    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )

    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == provider,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise AuthError(
            f"{provider.value.title()} is not connected.",
            "oauth_not_connected",
            404,
        )

    all_accounts = await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == user.id))
    oauth_count = len(list(all_accounts.scalars()))
    if not user.password_hash and oauth_count <= 1:
        raise AuthError(
            "Set a password before removing your only sign-in method.",
            "oauth_last_auth_method",
            400,
        )

    await db.execute(
        delete(OAuthAccount).where(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == provider,
        )
    )
    await _audit_oauth(
        db,
        event_type=AuditEventType.oauth_disconnected,
        user_id=user.id,
        ip=ip,
        provider=provider,
    )
    return await list_oauth_connections(db, user)
