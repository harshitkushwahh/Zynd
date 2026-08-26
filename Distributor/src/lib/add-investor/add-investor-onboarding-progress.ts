import type { LucideIcon } from "lucide-react";
import { KeyRound, Mail, Phone } from "lucide-react";

import type { AddInvestorWizardProgressStep } from "@/components/add-investor/add-investor-wizard-progress";

export type ContactOnboardingPhase = "email" | "mobile" | "account";

export const DISTRIBUTOR_ONBOARDING_PROGRESS_STEPS: AddInvestorWizardProgressStep[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "email-otp", label: "Email OTP", icon: KeyRound },
  { id: "mobile", label: "Mobile", icon: Phone },
  { id: "mobile-otp", label: "Mobile OTP", icon: KeyRound },
];

export const INVESTOR_ONBOARDING_PROGRESS_STEPS: AddInvestorWizardProgressStep[] = [
  ...DISTRIBUTOR_ONBOARDING_PROGRESS_STEPS,
  { id: "account", label: "Account", icon: KeyRound },
];
