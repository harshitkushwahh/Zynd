"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { FamilyGroupComingSoonOverlay } from "@/features/family-groups/components/family-group-coming-soon-overlay";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const DUMMY_PORTFOLIO_TOTAL_INR = 1_500_000;

const PLACEHOLDER_SLICES = [
  { id: "equity", label: "Equity Funds", value: 65, fill: "var(--zynd-emerald)" },
  { id: "debt", label: "Debt Funds", value: 20, fill: "#38bdf8" },
  { id: "hybrid", label: "Hybrid Funds", value: 10, fill: "#f59e0b" },
  { id: "other", label: "Others", value: 5, fill: "#a78bfa" },
] as const;

type PortfolioSlice = (typeof PLACEHOLDER_SLICES)[number] & { amountInr: number };

type FamilyGroupPortfolioPanelProps = {
  className?: string;
};

function sliceAmountInr(percent: number) {
  return Math.round((DUMMY_PORTFOLIO_TOTAL_INR * percent) / 100);
}

export function FamilyGroupPortfolioPanel({ className }: FamilyGroupPortfolioPanelProps) {
  const dashboard = copy.familyGroups.dashboard;
  const chartData: PortfolioSlice[] = PLACEHOLDER_SLICES.map((slice) => ({
    ...slice,
    amountInr: sliceAmountInr(slice.value),
  }));

  return (
    <section
      className={cn(
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        "h-full border border-border bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
    >
      <div>
        <h3 className="text-body font-semibold text-foreground">{dashboard.portfolioTitle}</h3>
        <p className="mt-1 text-compact text-muted-foreground">{dashboard.portfolioSubtitle}</p>
      </div>

      <div className="relative mt-5 min-h-[18rem]">
        <div className="pointer-events-none select-none blur-[5px]">
          <div className="flex flex-col items-center">
            <div className="relative mx-auto size-[12.5rem] sm:size-[13.5rem]">
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-body font-semibold tabular-nums tracking-tight text-foreground">
                  {formatInr(DUMMY_PORTFOLIO_TOTAL_INR)}
                </p>
                <p className="text-[11px] text-muted-foreground">{dashboard.totalValueLabel}</p>
              </div>

              <div className="relative z-10 size-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
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
                      {chartData.map((slice) => (
                        <Cell key={slice.id} fill={slice.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {chartData.map((slice) => (
                <span
                  key={slice.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/10 px-2.5 py-1 text-caption text-muted-foreground"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slice.fill }} />
                  <span>{slice.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{slice.value}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <FamilyGroupComingSoonOverlay
          title={dashboard.portfolioLockedTitle}
          subtitle={dashboard.portfolioLockedSubtitle}
        />
      </div>
    </section>
  );
}
