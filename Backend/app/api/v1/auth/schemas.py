from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CheckEmailRequest(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    next: Literal["continue"] = "continue"


class SignupStartRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = None
    referral_code: Optional[str] = Field(default=None, min_length=6, max_length=16)


class SignupStartResponse(BaseModel):
    next: Literal["signup", "login"] = "signup"
    signup_token: Optional[str] = None
    retry_after_seconds: int = 30
    expires_in: int = 600
    message: Optional[str] = None


class SignupResendEmailRequest(BaseModel):
    signup_token: str


class OtpSendResponse(BaseModel):
    ok: bool = True
    retry_after_seconds: int
    expires_in: int = 600


class SignupVerifyEmailRequest(BaseModel):
    signup_token: str
    otp: str = Field(min_length=6, max_length=6)


class SignupSetPasswordRequest(BaseModel):
    signup_token: str
    password: str = Field(min_length=8, max_length=128)


class SignupSendMobileRequest(BaseModel):
    signup_token: str
    mobile: str = Field(min_length=10, max_length=15)
    country_code: str = "IN"


class SignupVerifyMobileRequest(BaseModel):
    signup_token: str
    otp: str = Field(min_length=6, max_length=6)


class SignupCompleteRequest(BaseModel):
    signup_token: str
    first_name: str = Field(min_length=2, max_length=50)
    last_name: str = Field(min_length=2, max_length=50)
    middle_name: Optional[str] = Field(default=None, max_length=50)
    device_fingerprint: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    turnstile_token: Optional[str] = None
    device_fingerprint: str = Field(min_length=8, max_length=256)


class GoogleLoginRequest(BaseModel):
    id_token: str
    device_fingerprint: str = Field(min_length=8, max_length=256)
    oauth_state: Optional[str] = None
    referral_code: Optional[str] = Field(default=None, min_length=6, max_length=16)


class AppleLoginRequest(BaseModel):
    id_token: str
    device_fingerprint: str = Field(min_length=8, max_length=256)
    oauth_state: Optional[str] = None
    user_email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    referral_code: Optional[str] = Field(default=None, min_length=6, max_length=16)


class MfaDisableRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class MfaDisableResponse(BaseModel):
    disabled: bool = True


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)
    backup_code: Optional[str] = Field(default=None, min_length=8, max_length=12)


class OAuthLinkConfirmRequest(BaseModel):
    link_token: str
    email_otp: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=8, max_length=128)
    device_fingerprint: str = Field(min_length=8, max_length=256)


class MfaEnrollConfirmRequest(BaseModel):
    enroll_token: str
    totp_code: str = Field(min_length=6, max_length=6)


class MfaResetStartRequest(BaseModel):
    current_totp_code: str = Field(min_length=6, max_length=6)


class MfaResetConfirmRequest(BaseModel):
    reset_token: str
    totp_code: str = Field(min_length=6, max_length=6)


class StepUpRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class VerifyPasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeEmailStartRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeEmailConfirmRequest(BaseModel):
    change_token: str
    otp: str = Field(min_length=6, max_length=6)


class ChangeEmailResendRequest(BaseModel):
    change_token: str


class OAuthLinkResendRequest(BaseModel):
    link_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)
    backup_code: Optional[str] = Field(default=None, min_length=8, max_length=16)


class OAuthStateResponse(BaseModel):
    state: str
    expires_in: int = 600


class UserResponse(BaseModel):
    id: UUID
    email: str
    phone: Optional[str]
    first_name: Optional[str]
    middle_name: Optional[str]
    last_name: Optional[str]
    role: str
    country_code: str
    email_verified_at: Optional[datetime]
    phone_verified_at: Optional[datetime]
    mfa_enrolled: bool = False
    mfa_enrolled_at: Optional[datetime] = None
    pin_enrolled: bool = False
    pin_set_at: Optional[datetime] = None
    fund_movement_eligible: bool = False
    account_status: str = "active"
    deletion_scheduled_at: Optional[datetime] = None
    client_id: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    next: Literal["authenticated"] = "authenticated"
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    new_device: bool = False
    velocity_flagged: bool = False


class MfaRequiredResponse(BaseModel):
    next: Literal["mfa_required"] = "mfa_required"
    mfa_token: str
    expires_in: int = 300


class OAuthLinkRequiredResponse(BaseModel):
    next: Literal["oauth_link_confirmation_required"] = "oauth_link_confirmation_required"
    link_token: str
    expires_in: int
    email_hint: str
    provider: str
    retry_after_seconds: int = 30


class ChangeEmailStartResponse(BaseModel):
    change_token: str
    retry_after_seconds: int = 30
    expires_in: int = 600


class MfaEnrollStartResponse(BaseModel):
    enroll_token: str
    qr_uri: str
    manual_secret: str
    expires_in: int


class MfaResetStartResponse(BaseModel):
    reset_token: str
    qr_uri: str
    manual_secret: str
    expires_in: int


class MfaEnrollConfirmResponse(BaseModel):
    enrolled: bool = True
    backup_codes: list[str]
    mfa_enrolled_at: Optional[datetime]


class MfaBackupCodesStatusResponse(BaseModel):
    enrolled: bool
    total: int = 0
    remaining: int = 0
    used: int = 0


class MfaRegenerateBackupCodesResponse(BaseModel):
    backup_codes: list[str]


class FundEligibilityResponse(BaseModel):
    eligible: bool
    reasons: list[str]


class PinSetupRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: str = Field(min_length=6, max_length=6)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    confirm_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinVerifyRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinVerifyResponse(BaseModel):
    unlocked: bool = True
    expires_in: int = 3600


class PinResetConfirmRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=6)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    confirm_pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinOkResponse(BaseModel):
    ok: bool = True
    pin_enrolled: bool = True


class PinBiometricCredentialResponse(BaseModel):
    id: UUID
    credential_id: str
    device_name: Optional[str] = None
    created_at: datetime
    last_used_at: Optional[datetime] = None


class PinBiometricStatusResponse(BaseModel):
    enrolled: bool
    credentials: list[PinBiometricCredentialResponse]


class PinBiometricRegisterOptionsResponse(BaseModel):
    challenge_token: str
    options: dict[str, Any]


class PinBiometricRegisterVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=16, max_length=256)
    credential: dict[str, Any]
    device_name: Optional[str] = Field(default=None, max_length=128)


class PinBiometricRegisterVerifyResponse(BaseModel):
    ok: bool = True
    credential_id: str
    id: UUID
    device_name: Optional[str] = None


class PinBiometricUnlockOptionsRequest(BaseModel):
    credential_id: Optional[str] = Field(default=None, max_length=512)


class PinBiometricUnlockOptionsResponse(BaseModel):
    challenge_token: str
    options: dict[str, Any]


class PinBiometricUnlockVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=16, max_length=256)
    credential: dict[str, Any]


class SessionItemResponse(BaseModel):
    id: UUID
    is_current: bool
    os: Optional[str] = None
    browser: Optional[str] = None
    last_used_at: datetime
    created_at: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionItemResponse]


class RevokeSessionRequest(BaseModel):
    session_id: UUID


class RevokeSessionsResponse(BaseModel):
    revoked: int


class OAuthProviderStatusResponse(BaseModel):
    connected: bool
    email: Optional[str] = None


class OAuthConnectionsResponse(BaseModel):
    google: OAuthProviderStatusResponse
    apple: OAuthProviderStatusResponse


class OAuthConnectGoogleRequest(BaseModel):
    id_token: str
    oauth_state: Optional[str] = None


class OAuthConnectAppleRequest(BaseModel):
    id_token: str
    oauth_state: Optional[str] = None
    user_email: Optional[EmailStr] = None


class OAuthDisconnectRequest(BaseModel):
    provider: Literal["google", "apple"]
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


LoginFlowResponse = Union[AuthResponse, MfaRequiredResponse, OAuthLinkRequiredResponse]


class OkResponse(BaseModel):
    ok: bool = True


class VerifiedResponse(BaseModel):
    verified: bool = True
