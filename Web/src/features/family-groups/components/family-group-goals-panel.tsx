"use client";

import { Target } from "lucide-react";

import { FamilyGroupComingSoonOverlay } from "@/features/family-groups/components/family-group-coming-soon-overlay";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PLACEHOLDER_GOALS = [
  { id: "education", label: "Education fund", progress: 68 },
  { id: "home", label: "Home down payment", progress: 42 },
  { id: "retirement", label: "Retirement corpus", progress: 24 },
] as const;

type FamilyGroupGoalsPanelProps = {
  className?: string;
};

export function FamilyGroupGoalsPanel({ className }: FamilyGroupGoalsPanelProps) {
  const dashboard = copy.familyGroups.dashboard;

  return (
    <section
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "h-full border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div>
        <h3 className="text-body font-semibold text-foreground">{dashboard.goalTitle}</h3>
        <p className="mt-1 text-compact text-muted-foreground">{dashboard.goalSubtitle}</p>
      </div>

      <div className="relative mt-5 min-h-[18rem]">
        <div className="pointer-events-none select-none space-y-3 blur-[5px]">
          {PLACEHOLDER_GOALS.map((goal) => (
            <div
              key={goal.id}
              className={cn(
                FAMILY_GROUP_CARD_RADIUS_CLASS,
                "border border-border/70 bg-muted/10 p-4",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Target className="size-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-compact font-semibold text-foreground">{goal.label}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-caption tabular-nums text-muted-foreground">{goal.progress}% funded</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <FamilyGroupComingSoonOverlay
          title={dashboard.goalLockedTitle}
          subtitle={dashboard.goalLockedSubtitle}
        />
      </div>
    </section>
  );
}
