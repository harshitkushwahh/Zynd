"use client";

import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  type FamilyGroupPortfolioHolding,
  type FamilyGroupPortfolioSlice,
} from "@/features/family-groups/api/family-groups-api";
import { useFamilyGroupPortfolioQuery } from "@/features/family-groups/hooks/use-family-group-dashboard-queries";
import { FAMILY_GROUP_DASHBOARD_PANEL_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SLICE_COLORS: Record<string, string> = {
  equity: "var(--zynd-emerald)",
  debt: "#38bdf8",
  hybrid: "#f59e0b",
  other: "#a78bfa",
};

type FamilyGroupPortfolioPanelProps = {
  groupId: string;
  className?: string;
};

function FamilyPortfolioHoldingList({
  holdings,
  showUnassigned,
}: {
  holdings: FamilyGroupPortfolioHolding[];
  showUnassigned: boolean;
}) {
  const dashboard = copy.familyGroups.dashboard;
  if (holdings.length === 0) return null;
  const unassigned = showUnassigned ? holdings.filter((holding) => !holding.goal_id) : [];
  const assigned = showUnassigned ? holdings.filter((holding) => holding.goal_id) : holdings;

  return (
    <div className="mt-4 w-full space-y-3 text-left">
      {assigned.length > 0 ? (
        <ul className="space-y-2">
          {assigned.map((holding) => (
            <li key={holding.holding_id} className="flex items-start justify-between gap-3 text-caption">
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{holding.scheme_name}</span>
                <span className="text-muted-foreground">
                  {dashboard.portfolioHoldingMember} {holding.member_label}
                  {holding.goal_title ? ` · ${holding.goal_title}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                {formatInr(holding.current_value_inr)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {unassigned.length > 0 ? (
        <div className="space-y-2">
          <p className="text-caption font-medium text-muted-foreground">{dashboard.portfolioUnassignedTitle}</p>
          <ul className="space-y-2">
            {unassigned.map((holding) => (
              <li key={holding.holding_id} className="flex items-start justify-between gap-3 text-caption">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{holding.scheme_name}</span>
                  <span className="text-muted-foreground">
                    {dashboard.portfolioHoldingMember} {holding.member_label}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-foreground">
                  {formatInr(holding.current_value_inr)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function sliceColor(slice: FamilyGroupPortfolioSlice) {
  return SLICE_COLORS[slice.id] ?? SLICE_COLORS.other;
}

export function FamilyGroupPortfolioPanel({ groupId, className }: FamilyGroupPortfolioPanelProps) {
  const dashboard = copy.familyGroups.dashboard;
  const { portfolio, showSkeleton, errorMessage, refetch, isFetching } =
    useFamilyGroupPortfolioQuery(groupId);

  const chartData =
    portfolio?.slices.map((slice) => ({
      ...slice,
      fill: sliceColor(slice),
    })) ?? [];

  return (
    <section
      className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "h-full p-3 sm:p-4", className)}
    >
      <h3 className="text-compact font-semibold text-foreground">{dashboard.portfolioTitle}</h3>

      <div className="mt-2 min-h-[18rem]">
        {showSkeleton ? (
          <div className="flex h-[18rem] items-center justify-center text-compact text-muted-foreground">
            {dashboard.portfolioLoading}
          </div>
        ) : errorMessage ? (
          <LoadErrorCard
            title={dashboard.portfolioLoadFailed}
            description={errorMessage}
            retryLabel={copy.familyGroups.errors.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        ) : !portfolio || portfolio.total_current_value_inr <= 0 ? (
          <div className="flex h-[18rem] flex-col items-center justify-center gap-3 px-4 text-center">
            <PieChartIcon className="size-8 text-muted-foreground/70" />
            <div className="space-y-1">
              <p className="text-compact font-medium text-foreground">
                {dashboard.portfolioEmptyTitle}
              </p>
              <p className="text-compact text-muted-foreground">
                {dashboard.portfolioEmptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative mx-auto size-[12.5rem] sm:size-[13.5rem]">
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-body font-semibold tabular-nums tracking-tight text-foreground">
                  {formatInr(portfolio.total_current_value_inr)}
                </p>
                <p className="text-[11px] text-muted-foreground">{dashboard.totalValueLabel}</p>
              </div>
              <div className="relative z-10 size-full">
                <RechartsMeasuredContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value_pct"
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
                </RechartsMeasuredContainer>
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
                  <span className="font-medium tabular-nums text-foreground">{slice.value_pct.toFixed(0)}%</span>
                </span>
              ))}
            </div>
            <FamilyPortfolioHoldingList
              holdings={portfolio.holdings ?? []}
              showUnassigned={(portfolio.active_goals_count ?? 0) > 0}
            />
          </div>
        )}
      </div>
    </section>
  );
}
