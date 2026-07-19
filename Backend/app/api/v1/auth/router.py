from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import (
    clear_refresh_cookie,
    get_client_ip,
    get_current_session_id,
    get_current_user,
    get_refresh_token_from_request,
    handle_auth_error,
    require_fund_eligible_user,
    resolve_auth_client_from_request,
    set_refresh_cookie,
)
from app.application.auth.auth_client_policy import validate_user_role_for_client
from app.api.v1.auth.schemas import (
    AuthResponse,
    ChangeEmailConfirmRequest,
    ChangeEmailResendRequest,
    ChangeEmailStartRequest,
    ChangeEmailStartResponse,
    ChangePasswordRequest,
    CheckEmailRequest,
    CheckEmailResponse,
    ForgotPasswordRequest,
    FundEligibilityResponse,
    AppleLoginRequest,
    GoogleLoginRequest,
    LoginRequest,
    MfaDisableRequest,
    MfaDisableResponse,
    MfaEnrollConfirmRequest,
    MfaEnrollConfirmResponse,
    MfaEnrollStartResponse,
    MfaBackupCodesStatusResponse,
    MfaRegenerateBackupCodesResponse,
    MfaResetConfirmRequest,
    MfaResetStartRequest,
    MfaResetStartResponse,
    MfaRequiredResponse,
    MfaVerifyRequest,
    OAuthConnectAppleRequest,
    OAuthConnectGoogleRequest,
    OAuthConnectionsResponse,
    OAuthDisconnectRequest,
    OAuthLinkConfirmRequest,
    OAuthLinkResendRequest,
    OAuthLinkRequiredResponse,
    AdminInviteAcceptRequest,
    AdminInviteValidateResponse,
    OAuthStateResponse,
    OkResponse,
    OtpSendResponse,
    PinOkResponse,
    PinBiometricCredentialResponse,
    PinBiometricRegisterOptionsResponse,
    PinBiometricRegisterVerifyRequest,
    PinBiometricRegisterVerifyResponse,
    PinBiometricStatusResponse,
    PinBiometricUnlockOptionsRequest,
    PinBiometricUnlockOptionsResponse,
    PinBiometricUnlockVerifyRequest,
    PinResetConfirmRequest,
    PinSetupRequest,
    PinVerifyRequest,
    PinVerifyResponse,
    ResetPasswordRequest,
    RevokeSessionRequest,
    RevokeSessionsResponse,
    SessionItemResponse,
    SessionListResponse,
    SignupCompleteRequest,
    SignupResendEmailRequest,
    SignupSendMobileRequest,
    SignupSetPasswordRequest,
    SignupStartRequest,
    SignupStartResponse,
    SignupVerifyEmailRequest,
    SignupVerifyMobileRequest,
    StepUpRequest,
    VerifyPasswordRequest,
    UserResponse,
    VerifiedResponse,
)
from app.application.admin.admin_invitation_service import (
    accept_admin_invitation,
    validate_admin_invite_token,
)
from app.application.auth.account_service import (
    cancel_account_deletion,
    change_email_resend,
    change_email_confirm,
    change_email_start,
    change_password,
    resend_oauth_link_otp,
    confirm_oauth_link,
    fund_eligibility_status,
    mfa_disable,
    mfa_enroll_confirm,
    mfa_enroll_start,
    mfa_backup_codes_status,
    mfa_regenerate_backup_codes,
    mfa_reset_confirm,
    mfa_reset_start,
    request_account_deletion,
    verify_account_password,
    verify_mfa_login,
)
from app.application.auth.oauth_service import (
    connect_oauth_apple,
    connect_oauth_google,
    create_oauth_state,
    disconnect_oauth,
    list_oauth_connections,
)
from app.application.auth.errors import AuthError
from app.application.auth.login_service import check_email, login_with_email
from app.application.auth.oauth_login_service import login_with_apple, login_with_google
from app.application.auth.pin_biometric_service import (
    begin_pin_biometric_register,
    begin_pin_biometric_unlock,
    delete_pin_biometric_credential,
    finish_pin_biometric_register,
    finish_pin_biometric_unlock,
    list_pin_biometric_credentials,
)
from app.application.auth.pin_service import (
    reset_pin_with_otp,
    send_pin_reset_otp,
    setup_pin,
    verify_pin,
)
from app.application.auth.signup_service import (
    signup_complete,
    signup_resend_email_otp,
    signup_send_mobile_otp,
    signup_set_password,
    signup_start,
    signup_verify_email,
    signup_verify_mobile,
)
from app.application.auth.token_lifecycle_service import (
    forgot_password,
    logout,
    refresh_session,
    reset_password,
)
from app.application.auth.session_service import (
    list_user_sessions,
    revoke_all_sessions,
    revoke_user_session,
)
from app.application.auth.user_service import get_user_by_id, user_to_public_dict
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(user: User) -> UserResponse:
    data = user_to_public_dict(user)
    return UserResponse(**data)


def _auth_response(result: dict[str, Any]) -> AuthResponse:
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"]),
        new_device=result.get("new_device", False),
        velocity_flagged=result.get("velocity_flagged", False),
    )


def _validate_client_role(user: User, *, admin: bool) -> None:
    try:
        validate_user_role_for_client(user, admin_client=admin)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc


def _resolve_auth_client(request: Request, device_fingerprint: str | None) -> bool:
    try:
        return resolve_auth_client_from_request(request, device_fingerprint)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc


def _handle_login_result(
    result: dict[str, Any],
    response: Response,
    *,
    admin: bool = False,
) -> AuthResponse | MfaRequiredResponse | OAuthLinkRequiredResponse:
    if result["next"] == "mfa_required":
        return MfaRequiredResponse(
            mfa_token=result["mfa_token"],
            expires_in=result["expires_in"],
        )
    if result["next"] == "oauth_link_confirmation_required":
        return OAuthLinkRequiredResponse(
            link_token=result["link_token"],
            expires_in=result["expires_in"],
            email_hint=result["email_hint"],
            provider=result["provider"],
            retry_after_seconds=result.get("retry_after_seconds", 30),
        )
    _validate_client_role(result["user"], admin=admin)
    set_refresh_cookie(response, result["refresh_token"], admin=admin)
    return _auth_response(result)


@router.post("/check-email", response_model=CheckEmailResponse)
async def post_check_email(
    body: CheckEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckEmailResponse:
    result = await check_email(db, body.email)
    return CheckEmailResponse(**result)


@router.post("/signup/start", response_model=SignupStartResponse)
async def post_signup_start(
    body: SignupStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SignupStartResponse:
    try:
        result = await signup_start(
            db,
            email=body.email,
            turnstile_token=body.turnstile_token,
            ip=get_client_ip(request),
            referral_code=body.referral_code,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return SignupStartResponse(**result)


@router.post("/signup/verify-email", response_model=VerifiedResponse)
async def post_signup_verify_email(body: SignupVerifyEmailRequest) -> VerifiedResponse:
    try:
        await signup_verify_email(body.signup_token, body.otp)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return VerifiedResponse()


@router.post("/signup/resend-email-otp", response_model=OtpSendResponse)
async def post_signup_resend_email_otp(
    body: SignupResendEmailRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await signup_resend_email_otp(body.signup_token, ip=get_client_ip(request))
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/signup/set-password", response_model=OkResponse)
async def post_signup_set_password(body: SignupSetPasswordRequest) -> OkResponse:
    try:
        await signup_set_password(body.signup_token, body.password)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/signup/send-mobile-otp", response_model=OtpSendResponse)
async def post_signup_send_mobile(
    body: SignupSendMobileRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OtpSendResponse:
    try:
        result = await signup_send_mobile_otp(
            db,
            body.signup_token,
            body.mobile,
            body.country_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/signup/verify-mobile", response_model=VerifiedResponse)
async def post_signup_verify_mobile(body: SignupVerifyMobileRequest) -> VerifiedResponse:
    try:
        await signup_verify_mobile(body.signup_token, body.otp)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return VerifiedResponse()


@router.post("/signup/complete", response_model=AuthResponse)
async def post_signup_complete(
    body: SignupCompleteRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    try:
        user, access_token, refresh_token = await signup_complete(
            db,
            signup_token=body.signup_token,
            first_name=body.first_name,
            last_name=body.last_name,
            middle_name=body.middle_name,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    _resolve_auth_client(request, body.device_fingerprint)
    set_refresh_cookie(response, refresh_token, admin=False)
    return AuthResponse(access_token=access_token, user=_user_response(user))


@router.post("/login")
async def post_login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        admin_client = _resolve_auth_client(request, body.device_fingerprint)
        result = await login_with_email(
            db,
            email=body.email,
            password=body.password,
            turnstile_token=body.turnstile_token,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
            admin_client=admin_client,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response, admin=admin_client)


@router.post("/google")
async def post_google_login(
    body: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        admin_client = _resolve_auth_client(request, body.device_fingerprint)
        result = await login_with_google(
            db,
            id_token=body.id_token,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
            oauth_state=body.oauth_state,
            referral_code=body.referral_code,
            admin_client=admin_client,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response, admin=admin_client)


@router.post("/apple")
async def post_apple_login(
    body: AppleLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        admin_client = _resolve_auth_client(request, body.device_fingerprint)
        result = await login_with_apple(
            db,
            id_token=body.id_token,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
            oauth_state=body.oauth_state,
            user_email=body.user_email,
            first_name=body.first_name,
            last_name=body.last_name,
            referral_code=body.referral_code,
            admin_client=admin_client,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response, admin=admin_client)


@router.post("/mfa/verify")
async def post_mfa_verify(
    body: MfaVerifyRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await verify_mfa_login(
            db,
            mfa_token=body.mfa_token,
            totp_code=body.totp_code,
            backup_code=body.backup_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    admin_client = bool(result.get("admin_client"))
    resolved_client = _resolve_auth_client(request, result.get("device_fingerprint"))
    if resolved_client != admin_client:
        raise handle_auth_error(
            AuthError(
                "Sign-in client mismatch. Use the correct app to continue.",
                "invalid_auth_client",
                403,
            )
        )
    _validate_client_role(result["user"], admin=admin_client)
    set_refresh_cookie(response, result["refresh_token"], admin=admin_client)
    return _auth_response(result)


@router.post("/oauth/link/resend", response_model=OtpSendResponse)
async def post_oauth_link_resend(
    body: OAuthLinkResendRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await resend_oauth_link_otp(body.link_token, ip=get_client_ip(request))
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/oauth/link/confirm")
async def post_oauth_link_confirm(
    body: OAuthLinkConfirmRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await confirm_oauth_link(
            db,
            link_token=body.link_token,
            email_otp=body.email_otp,
            password=body.password,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    admin_client = _resolve_auth_client(request, body.device_fingerprint)
    return _handle_login_result(result, response, admin=admin_client)


@router.get("/oauth/connections", response_model=OAuthConnectionsResponse)
async def get_oauth_connections(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OAuthConnectionsResponse:
    result = await list_oauth_connections(db, current_user)
    return OAuthConnectionsResponse(**result)


@router.post("/oauth/connect/google", response_model=OAuthConnectionsResponse)
async def post_oauth_connect_google(
    body: OAuthConnectGoogleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OAuthConnectionsResponse:
    try:
        result = await connect_oauth_google(
            db,
            user=current_user,
            id_token=body.id_token,
            oauth_state=body.oauth_state,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OAuthConnectionsResponse(**result)


@router.post("/oauth/connect/apple", response_model=OAuthConnectionsResponse)
async def post_oauth_connect_apple(
    body: OAuthConnectAppleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OAuthConnectionsResponse:
    try:
        result = await connect_oauth_apple(
            db,
            user=current_user,
            id_token=body.id_token,
            user_email=body.user_email,
            oauth_state=body.oauth_state,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OAuthConnectionsResponse(**result)


@router.post("/oauth/disconnect", response_model=OAuthConnectionsResponse)
async def post_oauth_disconnect(
    body: OAuthDisconnectRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OAuthConnectionsResponse:
    from app.infrastructure.persistence.models import OAuthProvider

    try:
        result = await disconnect_oauth(
            db,
            user=current_user,
            session_id=session_id,
            provider=OAuthProvider(body.provider),
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OAuthConnectionsResponse(**result)


@router.post("/mfa/enroll/start", response_model=MfaEnrollStartResponse)
async def post_mfa_enroll_start(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaEnrollStartResponse:
    try:
        result = await mfa_enroll_start(db, current_user)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaEnrollStartResponse(**result)


@router.post("/mfa/enroll/confirm", response_model=MfaEnrollConfirmResponse)
async def post_mfa_enroll_confirm(
    body: MfaEnrollConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> MfaEnrollConfirmResponse:
    try:
        result = await mfa_enroll_confirm(
            db,
            user=current_user,
            enroll_token=body.enroll_token,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
            session_id=session_id,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return MfaEnrollConfirmResponse(**result)


@router.get("/mfa/backup-codes/status", response_model=MfaBackupCodesStatusResponse)
async def get_mfa_backup_codes_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaBackupCodesStatusResponse:
    result = await mfa_backup_codes_status(db, current_user)
    return MfaBackupCodesStatusResponse(**result)


@router.post("/mfa/disable", response_model=MfaDisableResponse)
async def post_mfa_disable(
    body: MfaDisableRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> MfaDisableResponse:
    try:
        result = await mfa_disable(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return MfaDisableResponse(**result)


@router.post("/mfa/backup-codes/regenerate", response_model=MfaRegenerateBackupCodesResponse)
async def post_mfa_regenerate_backup_codes(
    body: StepUpRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> MfaRegenerateBackupCodesResponse:
    try:
        result = await mfa_regenerate_backup_codes(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaRegenerateBackupCodesResponse(**result)


@router.post("/mfa/reset/start", response_model=MfaResetStartResponse)
async def post_mfa_reset_start(
    body: MfaResetStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaResetStartResponse:
    try:
        result = await mfa_reset_start(
            db,
            user=current_user,
            current_totp_code=body.current_totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaResetStartResponse(**result)


@router.post("/mfa/reset/confirm", response_model=MfaEnrollConfirmResponse)
async def post_mfa_reset_confirm(
    body: MfaResetConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaEnrollConfirmResponse:
    try:
        result = await mfa_reset_confirm(
            db,
            user=current_user,
            reset_token=body.reset_token,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaEnrollConfirmResponse(**result)


@router.get("/fund-eligibility/check", response_model=FundEligibilityResponse)
async def get_fund_eligibility(
    current_user: Annotated[User, Depends(get_current_user)],
) -> FundEligibilityResponse:
    result = fund_eligibility_status(current_user)
    return FundEligibilityResponse(**result)


@router.get("/fund-eligibility/gated-check", response_model=FundEligibilityResponse)
async def get_gated_fund_eligibility(
    current_user: Annotated[User, Depends(require_fund_eligible_user)],
) -> FundEligibilityResponse:
    result = fund_eligibility_status(current_user)
    return FundEligibilityResponse(**result)


@router.post("/pin/setup", response_model=PinOkResponse)
async def post_pin_setup(
    body: PinSetupRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> PinOkResponse:
    try:
        result = await setup_pin(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            totp_code=body.totp_code,
            pin=body.pin,
            confirm_pin=body.confirm_pin,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return PinOkResponse(**result)


@router.post("/pin/verify", response_model=PinVerifyResponse)
async def post_pin_verify(
    body: PinVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> PinVerifyResponse:
    try:
        result = await verify_pin(
            db,
            user=current_user,
            session_id=session_id,
            pin=body.pin,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return PinVerifyResponse(**result)


@router.post("/pin/forgot/send-otp", response_model=OtpSendResponse)
async def post_pin_forgot_send_otp(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OtpSendResponse:
    try:
        result = await send_pin_reset_otp(
            db,
            user=current_user,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return OtpSendResponse(**result)


@router.post("/pin/forgot/reset", response_model=PinOkResponse)
async def post_pin_forgot_reset(
    body: PinResetConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> PinOkResponse:
    try:
        result = await reset_pin_with_otp(
            db,
            user=current_user,
            session_id=session_id,
            otp=body.otp,
            pin=body.pin,
            confirm_pin=body.confirm_pin,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return PinOkResponse(**result)


@router.get("/pin/biometric/status", response_model=PinBiometricStatusResponse)
async def get_pin_biometric_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PinBiometricStatusResponse:
    credentials = await list_pin_biometric_credentials(db, current_user.id)
    return PinBiometricStatusResponse(
        enrolled=len(credentials) > 0,
        credentials=[PinBiometricCredentialResponse(**item) for item in credentials],
    )


@router.post("/pin/biometric/register/options", response_model=PinBiometricRegisterOptionsResponse)
async def post_pin_biometric_register_options(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PinBiometricRegisterOptionsResponse:
    try:
        result = await begin_pin_biometric_register(db, user=current_user)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return PinBiometricRegisterOptionsResponse(**result)


@router.post("/pin/biometric/register/verify", response_model=PinBiometricRegisterVerifyResponse)
async def post_pin_biometric_register_verify(
    body: PinBiometricRegisterVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PinBiometricRegisterVerifyResponse:
    try:
        result = await finish_pin_biometric_register(
            db,
            user=current_user,
            challenge_token=body.challenge_token,
            credential_json=body.credential,
            origin=request.headers.get("origin"),
            device_name=body.device_name,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return PinBiometricRegisterVerifyResponse(**result)


@router.post("/pin/biometric/unlock/options", response_model=PinBiometricUnlockOptionsResponse)
async def post_pin_biometric_unlock_options(
    body: PinBiometricUnlockOptionsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PinBiometricUnlockOptionsResponse:
    try:
        result = await begin_pin_biometric_unlock(
            db,
            user=current_user,
            credential_id=body.credential_id,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return PinBiometricUnlockOptionsResponse(**result)


@router.post("/pin/biometric/unlock/verify", response_model=PinVerifyResponse)
async def post_pin_biometric_unlock_verify(
    body: PinBiometricUnlockVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> PinVerifyResponse:
    try:
        result = await finish_pin_biometric_unlock(
            db,
            user=current_user,
            session_id=session_id,
            challenge_token=body.challenge_token,
            credential_json=body.credential,
            origin=request.headers.get("origin"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return PinVerifyResponse(**result)


@router.delete("/pin/biometric/credentials/{credential_record_id}", response_model=OkResponse)
async def delete_pin_biometric_credential_route(
    credential_record_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OkResponse:
    try:
        await delete_pin_biometric_credential(
            db,
            user=current_user,
            credential_record_id=credential_record_id,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    await db.commit()
    return OkResponse(ok=True)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> SessionListResponse:
    items = await list_user_sessions(
        db,
        user_id=current_user.id,
        current_session_id=session_id,
    )
    return SessionListResponse(sessions=[SessionItemResponse(**item) for item in items])


@router.post("/sessions/revoke", response_model=OkResponse)
async def post_revoke_session(
    body: RevokeSessionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    if body.session_id == session_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "cannot_revoke_current", "message": "Use sign out for this device."},
        )
    revoked = await revoke_user_session(
        db,
        user_id=current_user.id,
        session_id=body.session_id,
        ip=get_client_ip(request),
    )
    if not revoked:
        raise HTTPException(
            status_code=404,
            detail={"code": "session_not_found", "message": "Session not found."},
        )
    return OkResponse()


@router.post("/sessions/revoke-all", response_model=RevokeSessionsResponse)
async def post_revoke_all_sessions(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> RevokeSessionsResponse:
    revoked = await revoke_all_sessions(
        db,
        user_id=current_user.id,
        ip=get_client_ip(request),
        except_session_id=session_id,
        reason="user_revoke_all",
    )
    return RevokeSessionsResponse(revoked=revoked)


@router.post("/account/change-password", response_model=OkResponse)
async def post_change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    try:
        await change_password(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            new_password=body.new_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/account/verify-password", response_model=OkResponse)
async def post_verify_password(
    body: VerifyPasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> OkResponse:
    try:
        await verify_account_password(user=current_user, current_password=body.current_password)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/account/change-email/start", response_model=ChangeEmailStartResponse)
async def post_change_email_start(
    body: ChangeEmailStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> ChangeEmailStartResponse:
    try:
        result = await change_email_start(
            db,
            user=current_user,
            session_id=session_id,
            new_email=body.new_email,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return ChangeEmailStartResponse(**result)


@router.post("/account/change-email/resend", response_model=OtpSendResponse)
async def post_change_email_resend(
    body: ChangeEmailResendRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await change_email_resend(body.change_token, ip=get_client_ip(request))
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/account/change-email/confirm", response_model=OkResponse)
async def post_change_email_confirm(
    body: ChangeEmailConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    try:
        await change_email_confirm(
            db,
            user=current_user,
            session_id=session_id,
            change_token=body.change_token,
            otp=body.otp,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/account/delete-request")
async def post_delete_request(
    body: StepUpRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
):
    try:
        return await request_account_deletion(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc


@router.post("/account/delete-cancel", response_model=OkResponse)
async def post_delete_cancel(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OkResponse:
    try:
        await cancel_account_deletion(db, user=current_user, ip=get_client_ip(request))
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/refresh", response_model=AuthResponse)
async def post_refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    refresh_token, admin_client = get_refresh_token_from_request(request)
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "session_expired", "message": "Session expired"},
        )
    try:
        access_token, new_refresh_token = await refresh_session(
            db,
            refresh_token=refresh_token,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        clear_refresh_cookie(response, admin=admin_client)
        raise handle_auth_error(exc) from exc

    from app.infrastructure.security.tokens import decode_access_token

    payload = decode_access_token(access_token)
    user_id = UUID(payload["sub"])
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "User not found"})
    try:
        _validate_client_role(user, admin=admin_client)
    except HTTPException:
        clear_refresh_cookie(response, admin=admin_client)
        raise
    set_refresh_cookie(response, new_refresh_token, admin=admin_client)
    return AuthResponse(access_token=access_token, user=_user_response(user))


@router.post("/logout", response_model=OkResponse)
async def post_logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    refresh_token, admin_client = get_refresh_token_from_request(request)
    if refresh_token:
        await logout(db, refresh_token=refresh_token, ip=get_client_ip(request))
    clear_refresh_cookie(response, admin=admin_client)
    return OkResponse()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return _user_response(current_user)


@router.post("/oauth/state/google-login", response_model=OAuthStateResponse)
async def post_oauth_state_google_login() -> OAuthStateResponse:
    state = await create_oauth_state("google_login")
    return OAuthStateResponse(state=state)


@router.post("/oauth/state/apple-login", response_model=OAuthStateResponse)
async def post_oauth_state_apple_login() -> OAuthStateResponse:
    state = await create_oauth_state("apple_login")
    return OAuthStateResponse(state=state)


@router.post("/oauth/state/google-connect", response_model=OAuthStateResponse)
async def post_oauth_state_google_connect(
    _: Annotated[User, Depends(get_current_user)],
) -> OAuthStateResponse:
    state = await create_oauth_state("google_connect")
    return OAuthStateResponse(state=state)


@router.post("/oauth/state/apple-connect", response_model=OAuthStateResponse)
async def post_oauth_state_apple_connect(
    _: Annotated[User, Depends(get_current_user)],
) -> OAuthStateResponse:
    state = await create_oauth_state("apple_connect")
    return OAuthStateResponse(state=state)


@router.post("/forgot-password", response_model=OkResponse)
async def post_forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    try:
        await forgot_password(
            db,
            email=body.email,
            turnstile_token=body.turnstile_token,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
async def post_reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    try:
        await reset_password(
            db,
            token=body.token,
            new_password=body.new_password,
            totp_code=body.totp_code,
            backup_code=body.backup_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.get("/admin-invite/validate", response_model=AdminInviteValidateResponse)
async def get_admin_invite_validate(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminInviteValidateResponse:
    try:
        result = await validate_admin_invite_token(db, token=token)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return AdminInviteValidateResponse(**result)


@router.post("/admin-invite/accept", response_model=AuthResponse)
async def post_admin_invite_accept(
    body: AdminInviteAcceptRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    try:
        result = await accept_admin_invitation(
            db,
            token=body.token,
            first_name=body.first_name,
            last_name=body.last_name,
            password=body.password,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc

    await db.commit()
    admin_client = _resolve_auth_client(request, body.device_fingerprint)
    _validate_client_role(result["user"], admin=admin_client)
    set_refresh_cookie(response, result["refresh_token"], admin=admin_client)
    return _auth_response(result)


@router.get("/jwks")
async def get_jwks() -> dict[str, object]:
    from app.infrastructure.security.tokens import get_jwks_document

    return get_jwks_document()


@router.get("/passkeys/status")
async def get_passkeys_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, object]:
    from app.application.auth.webauthn_service import list_user_passkeys, passkeys_enabled

    return {
        "enabled": await passkeys_enabled(),
        "credentials": await list_user_passkeys(db, current_user.id),
    }
