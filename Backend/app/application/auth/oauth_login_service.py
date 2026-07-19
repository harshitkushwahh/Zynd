from __future__ import annotations

from typing import Any

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_session_context import (
    complete_authenticated_login,
    maybe_mfa_pending_login,
)
from app.application.auth.auth_client_policy import validate_user_role_for_client
from app.application.auth.errors import AuthError
from app.application.auth.oauth_service import require_oauth_state
from app.application.documents.client_id_service import assign_client_id
from app.application.referral.referral_attribution_service import attribute_referral_signup
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import OAuthAccount, OAuthProvider, User, UserRole
from app.infrastructure.persistence.referral_models import ReferralSignupChannel
from app.infrastructure.security.apple_oauth import is_apple_private_relay_email, verify_apple_identity_token


async def _process_oauth_login(
    db: AsyncSession,
    *,
    provider: OAuthProvider,
    provider_user_id: str,
    email: str | None,
    email_verified_by_provider: bool,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    admin_client: bool = False,
    settings: Settings | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    referral_code: str | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    normalized_email = email.lower().strip() if email else None
    is_relay_email = is_apple_private_relay_email(normalized_email)

    oauth_result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    oauth_account = oauth_result.scalar_one_or_none()

    if oauth_account:
        user_result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = user_result.scalar_one()
    elif normalized_email:
        user_result = await db.execute(select(User).where(User.email == normalized_email))
        user = user_result.scalar_one_or_none()
        if user:
            from app.application.auth.account_service import create_oauth_link_request

            return await create_oauth_link_request(
                db,
                user=user,
                provider=provider,
                provider_user_id=provider_user_id,
                provider_email=normalized_email,
                ip=ip,
            )

        user = User(
            email=normalized_email,
            role=UserRole.user,
            first_name=first_name,
            last_name=last_name,
        )
        if email_verified_by_provider and not is_relay_email:
            user.email_verified_at = utcnow()
        await assign_client_id(db, user)
        db.add(user)
        await db.flush()
        channel = ReferralSignupChannel.google if provider == OAuthProvider.google else ReferralSignupChannel.apple
        await attribute_referral_signup(
            db,
            referee=user,
            referral_code=referral_code,
            channel=channel,
        )
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=normalized_email,
        )
        db.add(oauth_account)
    else:
        raise AuthError(
            "Provider did not return an email address. Share your email to continue.",
            "oauth_no_email",
            400,
        )

    validate_user_role_for_client(user, admin_client=admin_client)

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider=provider.value,
        admin_client=admin_client,
    )
    if pending:
        return pending

    return await complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
        provider=provider.value,
    )


async def login_with_google(
    db: AsyncSession,
    *,
    id_token: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    oauth_state: str | None = None,
    referral_code: str | None = None,
    admin_client: bool = False,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    await require_oauth_state(oauth_state, "google_login", required_in_production=False)
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
    if not email:
        raise AuthError("Google account has no email.", "google_no_email", 400)

    return await _process_oauth_login(
        db,
        provider=OAuthProvider.google,
        provider_user_id=google_sub,
        email=email,
        email_verified_by_provider=True,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
        referral_code=referral_code,
        admin_client=admin_client,
    )


async def login_with_apple(
    db: AsyncSession,
    *,
    id_token: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    oauth_state: str | None = None,
    user_email: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    referral_code: str | None = None,
    admin_client: bool = False,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    await require_oauth_state(oauth_state, "apple_login", required_in_production=False)
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

    email_verified = str(claims.get("email_verified", "false")).lower() in {"true", "1"}

    return await _process_oauth_login(
        db,
        provider=OAuthProvider.apple,
        provider_user_id=apple_sub,
        email=email,
        email_verified_by_provider=email_verified,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
        first_name=first_name,
        last_name=last_name,
        referral_code=referral_code,
        admin_client=admin_client,
    )
