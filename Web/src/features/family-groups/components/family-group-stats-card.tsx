"use client";

import { CalendarDays, PiggyBank, Target, TrendingUp, UsersRound, Wallet } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupStatsCardProps = {
  memberCount: number;
  pendingInvites?: number;
  className?: string;
};

function StatRow({
  icon: Icon,
  label,
  value,
  accentClass,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  accentClass?: string;
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
        <p className="truncate text-body font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function FamilyGroupStatsCard({
  memberCount,
  pendingInvites = 0,
  className,
}: FamilyGroupStatsCardProps) {
  const dashboard = copy.familyGroups.dashboard;

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <h3 className="text-body font-semibold text-foreground">{dashboard.statsTitle}</h3>

      <div className="mt-4 space-y-2.5">
        <StatRow
          icon={UsersRound}
          label={dashboard.totalMembers}
          value={String(memberCount)}
          accentClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatRow
          icon={Wallet}
          label={dashboard.totalInvestment}
          value={dashboard.comingSoonValue}
          accentClass="text-sky-600 dark:text-sky-400"
        />
        <StatRow
          icon={TrendingUp}
          label={dashboard.totalCurrentValue}
          value={dashboard.comingSoonValue}
          accentClass="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-3.5" strokeWidth={2} />
            <span className="text-[10px] font-medium uppercase tracking-wide">{dashboard.sipsActive}</span>
          </div>
          <p className="mt-1 text-h4 font-semibold tabular-nums text-foreground">{dashboard.comingSoonCount}</p>
        </div>
        <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="size-3.5" strokeWidth={2} />
            <span className="text-[10px] font-medium uppercase tracking-wide">{dashboard.goalsCreated}</span>
          </div>
          <p className="mt-1 text-h4 font-semibold tabular-nums text-foreground">{dashboard.comingSoonCount}</p>
        </div>
      </div>

      {pendingInvites > 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
          <PiggyBank className="size-3.5 shrink-0" strokeWidth={2} />
          {dashboard.pendingInvites(pendingInvites)}
        </div>
      ) : null}

      <p className="mt-auto pt-3 text-[10px] leading-relaxed text-muted-foreground">{dashboard.statsFootnote}</p>
    </section>
  );
}
