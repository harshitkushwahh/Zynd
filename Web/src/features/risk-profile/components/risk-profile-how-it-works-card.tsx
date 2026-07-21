"use client";

import { HowItWorksEducationSection } from "@/components/ui/how-it-works-education-section";
import { copy } from "@/shared/config/copy";

export function RiskProfileHowItWorksCard() {
  return (
    <HowItWorksEducationSection
      id="risk-profile-education"
      title={copy.riskProfile.educationTitle}
      steps={copy.riskProfile.educationSteps}
    />
  );
}
