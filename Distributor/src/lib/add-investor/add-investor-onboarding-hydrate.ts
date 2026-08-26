import type { ClientOnboardingDraftSnapshot } from "@/lib/distributor-client-onboarding-api";

export type ClientOnboardingResumePhase = "email" | "mobile" | "account";

export type ClientOnboardingContactScreen = "input" | "otp" | "verified";

export function resolveClientOnboardingResume(
  draft: ClientOnboardingDraftSnapshot,
  onboardingComplete: boolean,
): { phase: ClientOnboardingResumePhase; contactScreen: ClientOnboardingContactScreen } {
  if (onboardingComplete || draft.ready_to_create) {
    return { phase: "account", contactScreen: "input" };
  }
  if (!draft.email_verified) {
    return { phase: "email", contactScreen: "input" };
  }
  if (!draft.mobile_verified) {
    return { phase: "mobile", contactScreen: "input" };
  }
  return { phase: "account", contactScreen: "input" };
}

export function getContactOnboardingProgressIndex(
  phase: ClientOnboardingResumePhase,
  contactScreen: ClientOnboardingContactScreen,
  draft: Pick<ClientOnboardingDraftSnapshot, "email_verified" | "mobile_verified">,
): number {
  if (phase === "email") {
    if (contactScreen === "verified" || draft.email_verified) return 1;
    return contactScreen === "input" ? 0 : 1;
  }
  if (phase === "mobile") {
    if (contactScreen === "verified" || draft.mobile_verified) return 3;
    return contactScreen === "input" ? 2 : 3;
  }
  return 4;
}
