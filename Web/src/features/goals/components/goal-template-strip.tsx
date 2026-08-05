"use client";

import type { GoalTemplate } from "@/features/goals/api/goals-api";
import { GoalTemplateScrollRow } from "@/features/goals/components/goal-template-scroll-row";
import { GoalTemplateCard } from "@/features/goals/components/goal-template-card";

type GoalTemplateStripProps = {
  templates: GoalTemplate[];
  onSelect: (template: GoalTemplate) => void;
};

export function GoalTemplateStrip({ templates, onSelect }: GoalTemplateStripProps) {
  if (templates.length === 0) return null;

  return (
    <GoalTemplateScrollRow>
      {templates.map((template) => (
        <GoalTemplateCard key={template.id} template={template} onSelect={onSelect} />
      ))}
    </GoalTemplateScrollRow>
  );
}
