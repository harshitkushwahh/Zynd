/** Browser storage keys — single source of truth (Phase 0). */

export const storageKeys = {
  signupSession: "zynd_signup_session",
  signupEmailOtpCooldown: "zynd:signup-email-otp",
  signupMobileOtpCooldown: "zynd:signup-mobile-otp",
  oauthLinkOtpCooldown: "zynd:oauth-link-otp",
  changeEmailOtpCooldown: "zynd:change-email-otp",
  loginSecurityAlerts: "zynd.login_security_alerts",
  sessionHint: "zynd:session-hint",
  pinUnlockedAt: "zynd:pin-unlocked-at",
  pinResetOtpCooldown: "zynd:pin-reset-otp",
  pinBiometricCredentialPrefix: "zynd:pin-biometric-credential:",
  mfaBackupCodesPrefix: "zynd:mfa-backup-codes:",
  deviceFingerprintPrefix: "zynd-",
  theme: "zynd:theme",
  turnstileSession: "zynd:turnstile-session",
  referralCode: "zynd:referral-code",
  familyInviteToken: "zynd:family-invite-token",
  familyGroupPinnedPrefix: "zynd:family-group-pinned:",
} as const;

export function mfaBackupCodesKey(userId: string): string {
  return `${storageKeys.mfaBackupCodesPrefix}${userId}`;
}
