"use client";

import type { GoalTemplate } from "@/features/goals/api/goals-api";
import { GoalTemplateVisualCard } from "@/features/goals/components/goal-template-visual-card";
import { GOAL_TEMPLATE_CARD_WIDTH_CLASS } from "@/features/goals/lib/goal-template-meta";
import { prefetchGoalTemplateIllustration } from "@/features/goals/lib/prefetch-goal-template-illustrations";
import { cn } from "@/lib/utils";

type GoalTemplateCardProps = {
  template: GoalTemplate;
  onSelect: (template: GoalTemplate) => void;
};

export function GoalTemplateCard({ template, onSelect }: GoalTemplateCardProps) {
  return (
    <div className={cn(GOAL_TEMPLATE_CARD_WIDTH_CLASS, "shrink-0")}>
      <GoalTemplateVisualCard
        slug={template.slug}
        name={template.name}
        description={template.description}
        imageUrl={template.image_url}
        iconKey={template.icon_key}
        variant="strip"
        interactive
        onActivate={() => onSelect(template)}
        onPointerEnter={() => prefetchGoalTemplateIllustration(template.slug)}
        onFocus={() => prefetchGoalTemplateIllustration(template.slug)}
      />
    </div>
  );
}
