"use client";

import { HowItWorksEducationSection } from "@/components/ui/how-it-works-education-section";
import { copy } from "@/shared/config/copy";

export function FamilyGroupHowItWorksCard() {
  return (
    <HowItWorksEducationSection
      id="family-group-education"
      title={copy.familyGroups.dashboard.educationTitle}
      steps={copy.familyGroups.dashboard.educationSteps}
    />
  );
}
