from __future__ import annotations

from typing import Annotated, Any, Optional
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.fund_movement_policy_service import evaluate_fund_eligibility
from app.application.auth.auth_client_policy import (
    is_admin_auth_header,
    is_admin_device_fingerprint as policy_is_admin_device_fingerprint,
    resolve_admin_client,
)
from app.application.auth.errors import AuthError
from app.application.auth.user_service import get_user_by_id
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User, UserRole, UserStatus
from app.infrastructure.security.tokens import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def is_admin_auth_client(request: Request) -> bool:
    return is_admin_auth_header(request.headers.get("x-zynd-client"))


def is_admin_device_fingerprint(fingerprint: str | None) -> bool:
    return policy_is_admin_device_fingerprint(fingerprint)


def resolve_auth_client_from_request(request: Request, device_fingerprint: str | None) -> bool:
    try:
        return resolve_admin_client(
            header_admin=is_admin_auth_client(request),
            fingerprint_admin=is_admin_device_fingerprint(device_fingerprint),
        )
    except AuthError:
        raise


def get_refresh_token_from_request(request: Request) -> tuple[str | None, bool]:
    settings = get_settings()
    if is_admin_auth_client(request):
        return request.cookies.get(settings.refresh_cookie_name_admin), True
    return request.cookies.get(settings.refresh_cookie_name), False


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        host = request.client.host
        if host in {"::1", "0:0:0:0:0:0:0:1"}:
            return "127.0.0.1"
        return host
    return None


def set_refresh_cookie(response, refresh_token: str, *, admin: bool = False) -> None:
    settings = get_settings()
    cookie_name = settings.refresh_cookie_name_admin if admin else settings.refresh_cookie_name
    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response, *, admin: bool = False) -> None:
    settings = get_settings()
    cookie_name = settings.refresh_cookie_name_admin if admin else settings.refresh_cookie_name
    response.delete_cookie(key=cookie_name, path="/api/v1/auth")


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Not authenticated"})
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=401, detail={"code": "session_expired", "message": "Session expired"}
        ) from None

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "User not found"})
    if user.status == UserStatus.deleted:
        raise HTTPException(status_code=403, detail={"code": "account_deleted", "message": "Account deleted"})
    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=403,
            detail={"code": "contact_support", "message": "Unable to continue. Contact support."},
        )
    return user


async def get_current_session_id(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
) -> UUID:
    if not credentials:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Not authenticated"})
    try:
        payload = decode_access_token(credentials.credentials)
        return UUID(payload["sid"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=401, detail={"code": "session_expired", "message": "Session expired"}
        ) from None


async def require_admin_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail={"code": "admin_required", "message": "Admin access required."},
        )
    from app.application.admin.rbac_service import ensure_rbac_seed, get_user_permission_keys

    await ensure_rbac_seed(db)
    if not await get_user_permission_keys(db, current_user.id):
        raise HTTPException(
            status_code=403,
            detail={"code": "admin_unassigned", "message": "Admin user has no assigned roles."},
        )
    return current_user


def require_permission(permission_key: str):
    async def _require_permission(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(require_admin_user)],
    ) -> User:
        from app.application.admin.rbac_service import user_has_permission

        if not await user_has_permission(db, current_user.id, permission_key):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "permission_denied",
                    "message": f"Missing permission: {permission_key}",
                },
            )
        return current_user

    return _require_permission


async def require_fund_eligible_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    eligibility = await evaluate_fund_eligibility(db, current_user)
    if not eligibility["eligible"]:
        reasons = eligibility["reasons"]
        if "pin_required" in reasons:
            gate_event = AuditEventType.fund_gate_blocked_pin
        elif (
            "phone_verification_required" in reasons
            or "email_verification_required" in reasons
            or "verified_contact_required" in reasons
        ):
            gate_event = AuditEventType.fund_gate_blocked_contact
        elif "mfa_required" in reasons:
            gate_event = AuditEventType.fund_gate_blocked_mfa
        else:
            gate_event = AuditEventType.fund_gate_blocked_contact
        db.add(
            AuditLog(
                user_id=current_user.id,
                event_type=gate_event,
                ip_address=get_client_ip(request),
                metadata_={"reasons": reasons},
            )
        )
        await db.flush()
        if "pin_required" in reasons:
            code = "pin_required"
            message = "Set up your Zynd PIN before moving funds."
        elif "phone_verification_required" in reasons:
            code = "phone_verification_required"
            message = "Verify your mobile number before moving funds."
        elif "email_verification_required" in reasons:
            code = "email_verification_required"
            message = "Verify your email address before moving funds."
        elif "verified_contact_required" in reasons:
            code = "verified_contact_required"
            message = "Verify your mobile number before moving funds."
        elif "mfa_required" in reasons:
            code = "mfa_required"
            message = "Enable MFA before moving funds."
        else:
            code = "not_eligible"
            message = "Complete security setup before moving funds."
        raise HTTPException(
            status_code=403,
            detail={
                "code": code,
                "message": message,
                "reasons": reasons,
            },
        )
    return current_user


async def require_invest_eligible_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_fund_eligible_user)],
) -> User:
    from app.infrastructure.persistence.models import KycOverallStatus, UserKycStatus

    status = await db.get(UserKycStatus, current_user.id)
    if not status or status.overall_status != KycOverallStatus.completed:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "kyc_required",
                "message": "Complete KYC verification before investing.",
            },
        )
    return current_user


def handle_auth_error(exc: AuthError) -> HTTPException:
    detail: dict[str, Any] = {"code": exc.code, "message": exc.message}
    detail.update(exc.metadata)
    return HTTPException(status_code=exc.status_code, detail=detail)
