"use client";

import { Car, Home, Lock, Plane, Plus, Users } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GOAL_PROGRESS_CARD_WIDTH_CLASS } from "@/features/goals/components/goal-progress-card";
import { formatGoalTargetCompact } from "@/features/goals/lib/goal-format";
import {
  goalStatusBadgeIcon,
  goalStatusBadgeVariant,
} from "@/features/goals/lib/goal-status-badge";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalsLockedSectionEmptyStateProps = {
  variant: "personal" | "family";
  className?: string;
};

const PERSONAL_GOAL_PREVIEWS = [
  {
    title: "Car fund",
    slug: "car",
    icon: Car,
    progress: 42,
    targetInr: 800_000,
  },
  {
    title: "Europe trip",
    slug: "travel",
    icon: Plane,
    progress: 18,
    targetInr: 200_000,
  },
  {
    title: "Home down payment",
    slug: "home",
    icon: Home,
    progress: 65,
    targetInr: 5_000_000,
  },
] as const;

const FAMILY_GOAL_PREVIEWS = [
  {
    title: "Family vacation",
    groupTitle: "Sharma Family",
    progress: 35,
    savedInr: 105_000,
    targetInr: 300_000,
  },
  {
    title: "Kids education",
    groupTitle: "Sharma Family",
    progress: 52,
    savedInr: 520_000,
    targetInr: 1_000_000,
  },
] as const;

function PreviewProgressRing({
  progress,
  icon: Icon,
  iconThemeClass,
  targetLabel,
}: {
  progress: number;
  icon: typeof Car;
  iconThemeClass: string;
  targetLabel: string;
}) {
  const size = 68;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <div className="relative flex size-[4.25rem] shrink-0 items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-md border",
            iconThemeClass,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.1} aria-hidden />
        </div>
        <span className="text-[11px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
          {targetLabel}
        </span>
      </div>
    </div>
  );
}

function PersonalGoalsPreview() {
  return (
    <div className="flex flex-wrap gap-3 px-4 py-5">
      {PERSONAL_GOAL_PREVIEWS.map((preview) => {
        const iconTheme = goalTemplateIconThemeFor(preview.slug);
        return (
          <div
            key={preview.title}
            className={cn(
              GOAL_PROGRESS_CARD_WIDTH_CLASS,
              "flex h-[5.5rem] shrink-0 flex-row items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-card p-2.5",
            )}
          >
            <PreviewProgressRing
              progress={preview.progress}
              icon={preview.icon}
              iconThemeClass={iconTheme.iconBadgeClass}
              targetLabel={formatGoalTargetCompact(preview.targetInr)}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{preview.title}</p>
              <StatusBadge
                variant={goalStatusBadgeVariant("active")}
                icon={goalStatusBadgeIcon("active")}
                className="w-fit px-1.5 text-[10px]"
              >
                {copy.goals.status.active}
              </StatusBadge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FamilyGoalsPreview() {
  return (
    <div className="grid gap-4 px-4 py-5 sm:grid-cols-2">
      {FAMILY_GOAL_PREVIEWS.map((preview) => (
        <Card key={preview.title} className="h-full">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{preview.title}</CardTitle>
                <p className="text-compact text-muted-foreground">
                  {preview.groupTitle} · Target {formatInr(preview.targetInr, { compact: true })}
                </p>
              </div>
            </div>
            <StatusBadge
              variant={goalStatusBadgeVariant("active")}
              icon={goalStatusBadgeIcon("active")}
            >
              {copy.goals.status.active}
            </StatusBadge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-compact">
                <span className="text-muted-foreground">{copy.goals.progressLabel}</span>
                <span className="font-medium">{preview.progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${preview.progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-compact text-muted-foreground">
                <span>{formatInr(preview.savedInr, { compact: true })} saved</span>
                <span>{copy.goals.familyGoalBadge}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GoalsSectionLockedOverlay({ variant }: { variant: "personal" | "family" }) {
  const title =
    variant === "personal" ? copy.goals.personalGoalsLockedTitle : copy.goals.familyGoalsLockedTitle;
  const description =
    variant === "personal"
      ? copy.goals.personalGoalsLockedDescription
      : copy.goals.familyGoalsLockedDescription;

  return (
    <div className="absolute inset-0 flex items-center justify-center px-3">
      <div className="flex max-w-md items-center gap-2.5 px-3 py-2.5 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
        <div className="relative shrink-0">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-3.5" strokeWidth={2.25} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <Plus className="size-2.5" strokeWidth={2.5} aria-hidden />
          </div>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-compact font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function GoalsLockedSectionEmptyState({ variant, className }: GoalsLockedSectionEmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-border/80 bg-card",
        variant === "personal" ? "min-h-[7.5rem]" : "min-h-[14rem]",
        className,
      )}
    >
      <div className="pointer-events-none select-none blur-[5px]">
        {variant === "personal" ? <PersonalGoalsPreview /> : <FamilyGoalsPreview />}
      </div>
      <div className="pointer-events-none absolute inset-0 sip-chart-overlay" aria-hidden />
      <GoalsSectionLockedOverlay variant={variant} />
    </div>
  );
}
