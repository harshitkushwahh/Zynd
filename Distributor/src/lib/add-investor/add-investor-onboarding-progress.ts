import type { LucideIcon } from "lucide-react";
import { Fingerprint, KeyRound, Mail, Phone } from "lucide-react";

import type { AddInvestorWizardProgressStep } from "@/components/add-investor/add-investor-wizard-progress";

export type ContactOnboardingPhase = "email" | "mobile" | "mfa";
export type ContactOnboardingScreen = "input" | "otp";

export const DISTRIBUTOR_ONBOARDING_PROGRESS_STEPS: AddInvestorWizardProgressStep[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "email-otp", label: "Email OTP", icon: KeyRound },
  { id: "mobile", label: "Mobile", icon: Phone },
  { id: "mobile-otp", label: "Mobile OTP", icon: KeyRound },
];

export const INVESTOR_ONBOARDING_PROGRESS_STEPS: AddInvestorWizardProgressStep[] = [
  ...DISTRIBUTOR_ONBOARDING_PROGRESS_STEPS,
  { id: "mfa", label: "MFA", icon: Fingerprint },
];

export function getContactOnboardingProgressIndex(
  phase: ContactOnboardingPhase,
  contactScreen: ContactOnboardingScreen,
): number {
  if (phase === "email") {
    return contactScreen === "input" ? 0 : 1;
  }
  if (phase === "mobile") {
    return contactScreen === "input" ? 2 : 3;
  }
  return 4;
}
