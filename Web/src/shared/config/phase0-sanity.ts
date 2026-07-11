/**
 * Phase 0 guardrails — covered by `src/shared/config/phase0-sanity.test.ts`.
 */

import { appConfig } from "@/shared/config/app-config";
import { APP_NAME, appTitle } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { storageKeys } from "@/shared/config/storage-keys";

export function phase0ConfigSanity() {
  if (appConfig.otpLength !== 6) {
    throw new Error("Unexpected otpLength");
  }
  if (!storageKeys.signupSession.startsWith("zynd")) {
    throw new Error("Signup session key prefix drift");
  }
  if (!copy.auth.welcomeTitle.includes(APP_NAME)) {
    throw new Error("Welcome copy must include app name");
  }
  if (!appTitle().includes(APP_NAME)) {
    throw new Error("appTitle must include app name");
  }
  return true;
}
