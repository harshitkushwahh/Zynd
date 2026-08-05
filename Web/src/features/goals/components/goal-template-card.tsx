"use client";

import { Plus } from "lucide-react";

import type { GoalTemplate } from "@/features/goals/api/goals-api";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import {
  GOAL_TEMPLATE_CARD_WIDTH_CLASS,
  goalTemplateIconThemeFor,
} from "@/features/goals/lib/goal-template-meta";
import { prefetchGoalTemplateIllustration } from "@/features/goals/lib/prefetch-goal-template-illustrations";
import { cn } from "@/lib/utils";

type GoalTemplateCardProps = {
  template: GoalTemplate;
  onSelect: (template: GoalTemplate) => void;
};

export function GoalTemplateCard({ template, onSelect }: GoalTemplateCardProps) {
  const Icon = getGoalTemplateIcon(template.icon_key);
  const iconTheme = goalTemplateIconThemeFor(template.slug);

  return (
    <div className={cn(GOAL_TEMPLATE_CARD_WIDTH_CLASS, "shrink-0 py-1")}>
      <button
        type="button"
        onClick={() => onSelect(template)}
        onMouseEnter={() => prefetchGoalTemplateIllustration(template.slug)}
        onFocus={() => prefetchGoalTemplateIllustration(template.slug)}
        className={cn(
          "group relative flex min-h-[8.75rem] w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card p-3 text-left shadow-zynd-low transition-all duration-300",
          "hover:-translate-y-1 hover:border-primary/25 hover:shadow-zynd-mid motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full border border-dashed border-border/90 bg-card text-muted-foreground transition-colors duration-300",
            "group-hover:border-[var(--zynd-navy)] group-hover:bg-[var(--zynd-navy)] group-hover:text-white",
          )}
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
        </span>

        <div className="flex h-full flex-col">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border",
              iconTheme.iconBadgeClass,
            )}
          >
            {template.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={template.image_url} alt="" className="size-full object-cover" />
            ) : (
              <Icon className="size-5" strokeWidth={2.1} aria-hidden />
            )}
          </div>

          <span className="mt-3 line-clamp-1 text-sm font-semibold text-foreground">{template.name}</span>
          {template.description ? (
            <span className="mt-1 line-clamp-3 text-[11px] leading-snug text-muted-foreground">
              {template.description}
            </span>
          ) : null}
        </div>
      </button>
    </div>
  );
}
