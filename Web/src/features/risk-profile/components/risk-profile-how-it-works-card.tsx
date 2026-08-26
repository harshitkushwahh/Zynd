"use client";

import { HowItWorksEducationSection } from "@/components/ui/how-it-works-education-section";
import { RISK_PROFILE_HERO_RADIUS_CLASS } from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";

export function RiskProfileHowItWorksCard() {
  return (
    <HowItWorksEducationSection
      id="risk-profile-education"
      title={copy.riskProfile.educationTitle}
      steps={copy.riskProfile.educationSteps}
      radiusClassName={RISK_PROFILE_HERO_RADIUS_CLASS}
    />
  );
}
