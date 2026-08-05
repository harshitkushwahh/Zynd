/** Browser storage keys — single source of truth (Phase 0). */

export const storageKeys = {
  signupSession: "zynd_signup_session",
  signupEmailOtpCooldown: "zynd:signup-email-otp",
  signupMobileOtpCooldown: "zynd:signup-mobile-otp",
  oauthLinkOtpCooldown: "zynd:oauth-link-otp",
  loginSmsOtpCooldown: "zynd:login-sms-otp",
  mfaLoginSmsOtpCooldown: "zynd:mfa-login-sms-otp",
  changeEmailOtpCooldown: "zynd:change-email-otp",
  loginSecurityAlerts: "zynd.login_security_alerts",
  sessionHint: "zynd:session-hint",
  pinUnlockedAt: "zynd:pin-unlocked-at",
  pinResetOtpCooldown: "zynd:pin-reset-otp",
  stepUpSmsCooldown: "zynd:step-up-sms-otp",
  pinBiometricCredentialPrefix: "zynd:pin-biometric-credential:",
  mfaBackupCodesPrefix: "zynd:mfa-backup-codes:",
  deviceFingerprintPrefix: "zynd-",
  theme: "zynd:theme",
  turnstileSession: "zynd:turnstile-session",
  referralCode: "zynd:referral-code",
  familyInviteToken: "zynd:family-invite-token",
  familyGroupPinnedPrefix: "zynd:family-group-pinned:",
  kycVerifiedConfettiShownPrefix: "zynd:kyc-verified-confetti:",
} as const;

export function mfaBackupCodesKey(userId: string): string {
  return `${storageKeys.mfaBackupCodesPrefix}${userId}`;
}

export function kycVerifiedConfettiKey(userId: string): string {
  return `${storageKeys.kycVerifiedConfettiShownPrefix}${userId}`;
}
