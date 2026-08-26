"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, PiggyBank, Target, TrendingUp, UsersRound, Wallet } from "lucide-react";

import { formatInr } from "@/features/invest/lib/mf-format";
import { FAMILY_GROUP_DASHBOARD_PANEL_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupStatsCardProps = {
  memberCount: number;
  pendingInvites?: number;
  activeGoalsCount?: number;
  activeSipsCount?: number;
  totalInvestedInr?: number;
  totalCurrentValueInr?: number;
  className?: string;
};

type StatTone = "emerald" | "sky" | "teal" | "violet" | "amber";

const STAT_TONE_CLASS: Record<StatTone, { icon: string; surface: string }> = {
  emerald: {
    icon: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    surface: "border-emerald-500/12 bg-emerald-500/[0.035]",
  },
  sky: {
    icon: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    surface: "border-sky-500/12 bg-sky-500/[0.035]",
  },
  teal: {
    icon: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    surface: "border-teal-500/12 bg-teal-500/[0.035]",
  },
  violet: {
    icon: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    surface: "border-violet-500/12 bg-violet-500/[0.035]",
  },
  amber: {
    icon: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    surface: "border-amber-500/12 bg-amber-500/[0.035]",
  },
};

function StatValue({
  value,
  muted = false,
  className,
}: {
  value: string;
  muted?: boolean;
  className?: string;
}) {
  if (muted) {
    return (
      <span
        className={cn(
          "inline-flex w-fit rounded-full border border-dashed border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className,
        )}
      >
        {value}
      </span>
    );
  }

  return (
    <p className={cn("truncate text-lg font-semibold tabular-nums leading-none tracking-tight text-foreground", className)}>
      {value}
    </p>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  mutedValue = false,
  featured = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: StatTone;
  mutedValue?: boolean;
  featured?: boolean;
  className?: string;
}) {
  const toneClass = STAT_TONE_CLASS[tone];

  if (featured) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-control)] border px-3 py-3",
          toneClass.surface,
          className,
        )}
      >
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", toneClass.icon)}>
          <Icon className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <div className="mt-1.5">
            <StatValue value={value} muted={mutedValue} className={mutedValue ? undefined : "text-body"} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-between rounded-[var(--radius-control)] border px-3 py-3",
        toneClass.surface,
        className,
      )}
    >
      <div className={cn("flex size-8 items-center justify-center rounded-full", toneClass.icon)}>
        <Icon className="size-3.5" strokeWidth={2} />
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <div className="mt-1.5">
          <StatValue value={value} muted={mutedValue} />
        </div>
      </div>
    </div>
  );
}

export function FamilyGroupStatsCard({
  memberCount,
  pendingInvites = 0,
  activeGoalsCount = 0,
  activeSipsCount = 0,
  totalInvestedInr = 0,
  totalCurrentValueInr = 0,
  className,
}: FamilyGroupStatsCardProps) {
  const dashboard = copy.familyGroups.dashboard;
  const hasPortfolioData = totalInvestedInr > 0 || totalCurrentValueInr > 0;

  return (
    <section className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "flex h-full flex-col p-3 sm:p-4", className)}>
      <h3 className="shrink-0 text-compact font-semibold text-foreground">{dashboard.statsTitle}</h3>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            icon={UsersRound}
            label={dashboard.totalMembers}
            value={String(memberCount)}
            tone="emerald"
          />
          <StatTile
            icon={Wallet}
            label={dashboard.totalInvestment}
            value={hasPortfolioData ? formatInr(totalInvestedInr, { compact: true }) : dashboard.comingSoonValue}
            tone="sky"
            mutedValue={!hasPortfolioData}
          />
        </div>

        <StatTile
          featured
          icon={TrendingUp}
          label={dashboard.totalCurrentValue}
          value={hasPortfolioData ? formatInr(totalCurrentValueInr, { compact: true }) : dashboard.comingSoonValue}
          tone="teal"
          mutedValue={!hasPortfolioData}
        />

        <div className="h-px bg-border/60" aria-hidden />

        <div className="mt-auto grid grid-cols-2 gap-2">
          <StatTile
            icon={CalendarDays}
            label={dashboard.sipsActive}
            value={activeSipsCount > 0 ? String(activeSipsCount) : dashboard.comingSoonCount}
            tone="violet"
            mutedValue={activeSipsCount <= 0}
          />
          <StatTile
            icon={Target}
            label={dashboard.goalsCreated}
            value={activeGoalsCount > 0 ? String(activeGoalsCount) : dashboard.comingSoonCount}
            tone="amber"
            mutedValue={activeGoalsCount <= 0}
          />
        </div>
      </div>

      {pendingInvites > 0 ? (
        <div className="mt-3 flex shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
          <PiggyBank className="size-3.5 shrink-0" strokeWidth={2} />
          {dashboard.pendingInvites(pendingInvites)}
        </div>
      ) : null}
    </section>
  );
}
