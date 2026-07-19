from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.errors import AuthError
from app.application.auth.login_security_service import evaluate_login_velocity
from app.application.auth.mfa_service import user_has_mfa
from app.application.auth.security_alerts_service import _device_label
from app.application.auth.session_service import enforce_session_cap
from app.application.messaging.auth_events import schedule_login_succeeded
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import (
    AuditEventType,
    Device,
    User,
    UserStatus,
)
from app.infrastructure.security.pending_auth import generate_pending_token, store_pending_auth
from app.infrastructure.security.tokens import create_access_token, generate_refresh_token, hash_token


def hash_fingerprint(fingerprint: str) -> str:
    return hash_token(fingerprint)


def parse_user_agent(user_agent: str | None) -> tuple[str | None, str | None]:
    if not user_agent:
        return None, None
    browser = "Unknown"
    os_name = "Unknown"
    ua = user_agent.lower()
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "edg" in ua:
        browser = "Edge"
    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    return os_name, browser


async def get_or_create_device(
    db: AsyncSession,
    *,
    user: User,
    fingerprint: str,
    user_agent: str | None,
) -> tuple[Device, bool]:
    fp_hash = hash_fingerprint(fingerprint)
    result = await db.execute(
        select(Device).where(Device.user_id == user.id, Device.fingerprint_hash == fp_hash)
    )
    device = result.scalar_one_or_none()
    if device:
        device.last_seen_at = utcnow()
        if user_agent:
            device.user_agent = user_agent
        return device, False

    os_name, browser = parse_user_agent(user_agent)
    device = Device(
        user_id=user.id,
        fingerprint_hash=fp_hash,
        user_agent=user_agent,
        os=os_name,
        browser=browser,
    )
    db.add(device)
    await db.flush()
    return device, True


async def create_authenticated_session(
    db: AsyncSession,
    *,
    user: User,
    device: Device | None,
    settings: Settings,
    ip: str | None,
    token_family_id: UUID | None = None,
) -> tuple[str, str, Any]:
    from app.infrastructure.persistence.models import Session

    await enforce_session_cap(db, user_id=user.id, settings=settings, ip=ip)

    family_id = token_family_id or uuid4()
    refresh_token = generate_refresh_token()
    session = Session(
        user_id=user.id,
        device_id=device.id if device else None,
        refresh_token_hash=hash_token(refresh_token),
        token_family_id=family_id,
        expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    await db.flush()
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        session_id=session.id,
        settings=settings,
    )
    await write_audit(
        db,
        event_type=AuditEventType.session_created,
        user_id=user.id,
        ip=ip,
        metadata={"session_id": str(session.id)},
    )
    return access_token, refresh_token, session


async def complete_authenticated_login(
    db: AsyncSession,
    *,
    user: User,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()

    if user.status == UserStatus.deleted:
        raise AuthError("Account is no longer available.", "account_deleted", 403)

    if user.status == UserStatus.suspended:
        raise AuthError("Unable to sign in. Contact support.", "contact_support", 403)

    device, is_new_device = await get_or_create_device(
        db, user=user, fingerprint=device_fingerprint, user_agent=user_agent
    )
    access_token, refresh_token, _ = await create_authenticated_session(
        db, user=user, device=device, settings=settings, ip=ip
    )
    metadata: dict[str, Any] = {}
    if provider:
        metadata["provider"] = provider
    await write_audit(
        db,
        event_type=AuditEventType.login_success,
        user_id=user.id,
        ip=ip,
        metadata=metadata or None,
    )
    velocity_flag = await evaluate_login_velocity(user.id, ip)
    velocity_flagged = False
    if velocity_flag:
        velocity_flagged = True
        await write_audit(
            db,
            event_type=AuditEventType.login_velocity_flagged,
            user_id=user.id,
            ip=ip,
            metadata=velocity_flag,
        )
    if is_new_device:
        await write_audit(
            db,
            event_type=AuditEventType.new_device_login,
            user_id=user.id,
            ip=ip,
            metadata={"device_id": str(device.id)},
        )
    schedule_login_succeeded(
        user_id=user.id,
        email=user.email,
        ip=ip,
        device_id=device.id,
        device_label=_device_label(device),
        is_new_device=is_new_device,
        velocity_flag=velocity_flag,
        provider=provider,
    )
    return {
        "next": "authenticated",
        "user": user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "new_device": is_new_device,
        "velocity_flagged": velocity_flagged,
    }


async def maybe_mfa_pending_login(
    user: User,
    *,
    device_fingerprint: str,
    user_agent: str | None,
    provider: str | None = None,
    admin_client: bool = False,
) -> dict[str, Any] | None:
    if not user_has_mfa(user):
        return None

    settings = get_settings()
    mfa_token = generate_pending_token()
    await store_pending_auth(
        "mfa_login",
        mfa_token,
        {
            "user_id": str(user.id),
            "device_fingerprint": device_fingerprint,
            "user_agent": user_agent,
            "provider": provider,
            "admin_client": admin_client,
        },
        settings.mfa_pending_ttl_seconds,
    )
    return {
        "next": "mfa_required",
        "mfa_token": mfa_token,
        "expires_in": settings.mfa_pending_ttl_seconds,
    }
