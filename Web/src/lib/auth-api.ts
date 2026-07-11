/** @deprecated Import from `@/features/auth/api/*` — barrel kept for backward compatibility. */

export type {
  AppleLoginProfile,
  AuthUser,
  LoginFlowResponse,
  OAuthConnections,
  OAuthProviderStatus,
  OtpSendResponse,
  SignupStartResponse,
  UserSession,
} from "@/features/auth/api/types";

export { isAuthenticatedResponse } from "@/features/auth/api/types";

export {
  signupStart,
  signupResendEmailOtp,
  signupVerifyEmail,
  signupSetPassword,
  signupSendMobileOtp,
  signupVerifyMobile,
  signupComplete,
} from "@/features/auth/api/signup-api";

export {
  login,
  loginWithGoogle,
  loginWithApple,
  verifyMfaLogin,
  resendOAuthLinkOtp,
  confirmOAuthLink,
} from "@/features/auth/api/login-api";

export {
  bootstrapSession,
  fetchCurrentUser,
  getDisplayName,
  logout,
} from "@/features/auth/api/session-api";

export { forgotPassword, resetPassword } from "@/features/auth/api/password-api";

export {
  connectOAuthApple,
  connectOAuthGoogle,
  disconnectOAuth,
  fetchOAuthConnections,
} from "@/features/account/api/oauth-api";

export {
  checkFundEligibility,
  fetchMfaBackupCodesStatus,
  mfaDisable,
  mfaEnrollConfirm,
  mfaEnrollStart,
  mfaResetConfirm,
  mfaResetStart,
  regenerateMfaBackupCodes,
} from "@/features/account/api/mfa-api";

export {
  resetZyndPinWithOtp,
  sendZyndPinResetOtp,
  setupZyndPin,
  verifyZyndPin,
} from "@/features/account/pin/api/pin-api";

export {
  cancelAccountDeletion,
  changeEmailConfirm,
  changeEmailResend,
  changeEmailStart,
  changePassword,
  fetchSessions,
  requestAccountDeletion,
  revokeAllOtherSessions,
  revokeSession,
  verifyAccountPassword,
} from "@/features/account/api/account-api";
