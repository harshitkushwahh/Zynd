import { DEFAULT_COUNTRY } from "@/lib/input-rules";

/** Runtime app behavior — no user-facing copy. */
export const appConfig = {
  sessionRetryIntervalMs: 3_000,
  bootstrapRetryAttempts: 3,
  bootstrapRetryBaseDelayMs: 400,
  otpLength: 6,
  pinLength: 4,
  pinIdleTimeoutMs: 60 * 60 * 1000,
  deletionGracePeriodDays: 30,
  maxActiveDevices: 3,
  defaultCountry: DEFAULT_COUNTRY,
} as const;

export type AppConfig = typeof appConfig;
