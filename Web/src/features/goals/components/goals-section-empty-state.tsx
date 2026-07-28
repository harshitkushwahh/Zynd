"use client";

import { Target, Users } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalsSectionEmptyStateProps = {
  variant: "personal" | "family";
  compact?: boolean;
  className?: string;
};

export function GoalsSectionEmptyState({
  variant,
  compact = false,
  className,
}: GoalsSectionEmptyStateProps) {
  const Icon = variant === "personal" ? Target : Users;
  const title =
    variant === "personal"
      ? copy.goals.personalGoalsListEmptyTitle
      : copy.goals.familyGoalsListEmptyTitle;
  const description =
    variant === "personal"
      ? copy.goals.personalGoalsListEmptyDescription
      : copy.goals.familyGoalsListEmptyDescription;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border/80 bg-muted/10 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </div>
      <p className="mt-3 text-compact font-semibold text-foreground">{title}</p>
      {!compact ? (
        <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
