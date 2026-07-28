"use client";

import { HowItWorksEducationSection } from "@/components/ui/how-it-works-education-section";
import { copy } from "@/shared/config/copy";

export function GoalsHowItWorksCard() {
  return (
    <HowItWorksEducationSection
      id="goals-education"
      title={copy.goals.educationTitle}
      steps={copy.goals.educationSteps}
    />
  );
}
