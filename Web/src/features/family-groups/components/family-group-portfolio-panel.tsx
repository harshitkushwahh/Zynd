"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PLACEHOLDER_SLICES = [
  { id: "equity", label: "Equity Funds", value: 65, fill: "var(--zynd-emerald)" },
  { id: "debt", label: "Debt Funds", value: 20, fill: "#38bdf8" },
  { id: "hybrid", label: "Hybrid Funds", value: 10, fill: "#f59e0b" },
  { id: "other", label: "Others", value: 5, fill: "#a78bfa" },
] as const;

type FamilyGroupPortfolioPanelProps = {
  className?: string;
};

export function FamilyGroupPortfolioPanel({ className }: FamilyGroupPortfolioPanelProps) {
  const dashboard = copy.familyGroups.dashboard;

  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{dashboard.portfolioTitle}</h3>
          <p className="mt-1 text-compact text-muted-foreground">{dashboard.portfolioSubtitle}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {dashboard.comingSoonBadge}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="relative mx-auto size-[12.5rem] opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PLACEHOLDER_SLICES}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {PLACEHOLDER_SLICES.map((slice) => (
                  <Cell key={slice.id} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <p className="text-h4 font-semibold tabular-nums text-foreground">{dashboard.comingSoonValue}</p>
            <p className="text-[11px] text-muted-foreground">{dashboard.totalValueLabel}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {PLACEHOLDER_SLICES.map((slice) => (
            <div
              key={slice.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.fill }} />
                <span className="truncate text-caption text-foreground">{slice.label}</span>
              </div>
              <span className="text-caption font-medium tabular-nums text-muted-foreground">{slice.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
