import { DEFAULT_COUNTRY } from "@/lib/input-rules";

/** Runtime app behavior  no user-facing copy. */
export const appConfig = {
  sessionRetryIntervalMs: 15_000,
  sessionRetryMaxIntervalMs: 60_000,
  /** Stop background refresh retries and clear stale session hints (landing stops polling). */
  sessionRetryMaxAttempts: 8,
  bootstrapRetryAttempts: 4,
  bootstrapRetryBaseDelayMs: 400,
  otpLength: 6,
  /** Matches Backend FUND_CONFIRMATION_OTP_TTL_SECONDS (1:30) for transaction consent UI. */
  otpExpiresInSeconds: 90,
  otpResendCooldownSeconds: 30,
  pinLength: 4,
  pinIdleTimeoutMs: 60 * 60 * 1000,
  deletionGracePeriodDays: 30,
  maxActiveDevices: 3,
  defaultCountry: DEFAULT_COUNTRY,
} as const;

export type AppConfig = typeof appConfig;
