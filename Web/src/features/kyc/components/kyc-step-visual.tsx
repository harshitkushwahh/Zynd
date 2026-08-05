"use client";

import type { ReactNode } from "react";

import { KycAadhaarLottie } from "@/features/kyc/components/kyc-aadhaar-lottie";
import type { KycJourneyStepId } from "@/features/kyc/lib/kyc-journey";

export function getKycStepPanelVisual(stepId?: KycJourneyStepId): ReactNode | null {
  switch (stepId) {
    case "signature":
      return <KycAadhaarLottie variant="hero" />;
    default:
      return null;
  }
}
