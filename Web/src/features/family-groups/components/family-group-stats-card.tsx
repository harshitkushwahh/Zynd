"use client";

import { CalendarDays, PiggyBank, Target, TrendingUp, UsersRound, Wallet } from "lucide-react";

import { formatInr } from "@/features/invest/lib/mf-format";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
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

function StatRow({
  icon: Icon,
  label,
  value,
  accentClass,
  mutedValue = false,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  accentClass?: string;
  mutedValue?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
          accentClass,
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate tabular-nums tracking-tight",
            mutedValue
              ? "text-compact font-medium text-muted-foreground"
              : "text-body font-semibold text-foreground",
          )}
        >
          {value}
        </p>
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
    <section
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "flex h-full flex-col border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <h3 className="shrink-0 text-body font-semibold text-foreground">{dashboard.statsTitle}</h3>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2.5">
        <StatRow
          icon={UsersRound}
          label={dashboard.totalMembers}
          value={String(memberCount)}
          accentClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatRow
          icon={Wallet}
          label={dashboard.totalInvestment}
          value={hasPortfolioData ? formatInr(totalInvestedInr, { compact: true }) : dashboard.comingSoonValue}
          accentClass="text-sky-600 dark:text-sky-400"
          mutedValue={!hasPortfolioData}
        />
        <StatRow
          icon={TrendingUp}
          label={dashboard.totalCurrentValue}
          value={hasPortfolioData ? formatInr(totalCurrentValueInr, { compact: true }) : dashboard.comingSoonValue}
          accentClass="text-emerald-600 dark:text-emerald-400"
          mutedValue={!hasPortfolioData}
        />

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-3.5" strokeWidth={2} />
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground">{dashboard.sipsActive}</span>
            </div>
            <p className="mt-1 text-compact font-medium tabular-nums text-foreground">
              {activeSipsCount > 0 ? String(activeSipsCount) : dashboard.comingSoonCount}
            </p>
          </div>
          <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="size-3.5" strokeWidth={2} />
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground">{dashboard.goalsCreated}</span>
            </div>
            <p className="mt-1 text-compact font-medium tabular-nums text-foreground">
              {activeGoalsCount > 0 ? String(activeGoalsCount) : dashboard.comingSoonCount}
            </p>
          </div>
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
