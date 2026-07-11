"""Backward-compatible facade — import from specific auth modules instead.

Phase 1 split:
- signup_service
- login_service
- oauth_login_service
- token_lifecycle_service
- user_service
- auth_session_context (session/device helpers)
"""

from app.application.auth.auth_session_context import (
    complete_authenticated_login as _complete_authenticated_login,
    maybe_mfa_pending_login as _maybe_mfa_pending_login,
)
from app.application.auth.errors import AuthError
from app.application.auth.login_service import check_email, login_with_email
from app.application.auth.oauth_login_service import login_with_apple, login_with_google
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
from app.application.auth.user_service import get_user_by_id, user_to_public_dict

__all__ = [
    "AuthError",
    "_complete_authenticated_login",
    "_maybe_mfa_pending_login",
    "check_email",
    "forgot_password",
    "get_user_by_id",
    "login_with_apple",
    "login_with_email",
    "login_with_google",
    "logout",
    "refresh_session",
    "reset_password",
    "signup_complete",
    "signup_resend_email_otp",
    "signup_send_mobile_otp",
    "signup_set_password",
    "signup_start",
    "signup_verify_email",
    "signup_verify_mobile",
    "user_to_public_dict",
]
