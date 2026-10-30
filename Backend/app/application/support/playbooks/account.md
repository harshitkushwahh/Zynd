# Settings and account

Settings cover profile, investor details, nominee, security (password, MFA, Zynd PIN, backup codes), and linked sign-in providers.

Use these context fields directly — do not guess:

- Google / Apple: `google_account_linked`, `apple_account_linked`, and `linked_sign_in_providers`.
- MFA: `mfa_enrolled`, `mfa_enrolled_at`; backup codes in `settings.backup_codes_remaining`.
- Zynd PIN: `pin_enrolled`, `pin_set_at`. Reset path: Settings → Security → Zynd PIN (OTP/MFA verification).
- Nominee from Settings: `settings.nominee_last_updated_at` and `settings.nominee_last_update_source` (`user` means updated in Settings, not only during KYC).
- Email changes: `email_changed_at` or `email_verified_at`.

This bot cannot change passwords, turn MFA off, or edit profile fields. Give the correct in-app path only.

For risk profile or investor reports, use the risk_profile and reports slices — not KYC completion dates.
