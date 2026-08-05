"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Car, Home, Lock, Plane, Plus, User, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/features/goals/api/goals-api";
import { GoalPriorityChip } from "@/features/goals/components/goal-priority-badge-picker";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import type { DashboardFamilyGoal } from "@/features/goals/lib/goal-family-goals";
import {
  GOAL_MAX_FAMILY_ACTIVE_PER_GROUP,
  GOAL_MAX_PERSONAL_ACTIVE,
} from "@/features/goals/lib/goal-limits";
import {
  buildCombinedGoalSummaryChartData,
  computeSummarySliceCoverage,
  countCoveredSummarySlices,
  pickTopPrioritySummarySlice,
  type GoalSummaryChartSlice,
} from "@/features/goals/lib/goal-summary";
import { goalSummarySliceHref } from "@/features/goals/lib/goal-navigation";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalsSummaryPanelProps = {
  personalGoals: Goal[];
  familyGoals: DashboardFamilyGoal[];
  className?: string;
};

function GoalsSummaryCapacityBadge({
  personalCount,
  familyCount,
  className,
}: {
  personalCount: number;
  familyCount: number;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "mt-2 h-auto gap-2 px-2.5 py-1 text-[10px] font-medium tabular-nums shadow-sm",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        <User className="size-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
        Personal {personalCount}/{GOAL_MAX_PERSONAL_ACTIVE}
      </span>
      <span className="text-muted-foreground/60" aria-hidden>
        ·
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="size-3 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
        Family {familyCount}/{GOAL_MAX_FAMILY_ACTIVE_PER_GROUP}
      </span>
    </Badge>
  );
}

function GoalSummaryMiniCardFromSlice({ slice }: { slice: GoalSummaryChartSlice }) {
  if (slice.kind === "personal" && slice.personalGoal) {
    const goal = slice.personalGoal;
    const Icon = getGoalTemplateIcon(goal.template?.icon_key);
    const iconTheme = goalTemplateIconThemeFor(goal.template?.slug ?? "custom");

    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-card)] border border-border/70 bg-background/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border",
            iconTheme.iconBadgeClass,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.1} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-foreground">{goal.title}</p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {copy.goals.summarySliceCovered(Math.round(slice.progress))}
          </p>
        </div>
      </div>
    );
  }

  if (slice.kind === "family" && slice.familyGoal) {
    const goal = slice.familyGoal;
    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-card)] border border-border/70 bg-background/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
          <Users className="size-3.5" strokeWidth={2.1} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-foreground">{goal.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{goal.groupTitle}</p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {copy.goals.summarySliceCovered(Math.round(slice.progress))}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function TopPrioritySummaryCard({ slice }: { slice: GoalSummaryChartSlice }) {
  const href = goalSummarySliceHref(slice);
  const priority =
    slice.personalGoal?.priority ?? slice.familyGoal?.priority ?? 3;
  const title = slice.personalGoal?.title ?? slice.familyGoal?.title ?? slice.label;
  const saved =
    slice.personalGoal?.effective_current_amount_inr ??
    slice.personalGoal?.current_amount_inr ??
    slice.familyGoal?.effective_current_amount_inr ??
    slice.familyGoal?.current_amount_inr ??
    0;
  const target =
    slice.personalGoal?.target_amount_inr ?? slice.familyGoal?.target_amount_inr ?? 0;
  const subtitle =
    slice.kind === "family" && slice.familyGoal
      ? `${slice.familyGoal.groupTitle} · ${copy.goals.familyGoalBadge}`
      : null;

  const Icon =
    slice.kind === "family"
      ? Users
      : getGoalTemplateIcon(slice.personalGoal?.template?.icon_key);
  const iconTheme =
    slice.kind === "family"
      ? "border-indigo-200/70 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
      : goalTemplateIconThemeFor(slice.personalGoal?.template?.slug ?? "custom").iconBadgeClass;

  const card = (
    <div className="rounded-[var(--radius-card)] border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
          {copy.goals.summaryTopPriorityLabel}
        </p>
        <GoalPriorityChip priority={priority} className="h-6 px-2 text-[9px]" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border",
            iconTheme,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.1} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{title}</p>
          {subtitle ? (
            <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
          ) : (
            <p className="truncate text-[10px] tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatInr(saved, { compact: true })}</span>
              {" "}{copy.goals.detailOfTargetLabel}{" "}
              <span className="font-medium text-foreground">{formatInr(target, { compact: true })}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums leading-none text-foreground">
            {slice.progress.toFixed(0)}%
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">{copy.goals.progressLabel}</p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
          style={{ width: `${slice.progress}%` }}
        />
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label={`${copy.goals.summaryTopPriorityLabel}: ${title}`}
    >
      {card}
    </Link>
  );
}

function GoalSummaryChartChip({
  slice,
  selected,
  dimmed,
  onSelect,
}: {
  slice: GoalSummaryChartSlice;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon =
    slice.kind === "family"
      ? Users
      : getGoalTemplateIcon(slice.personalGoal?.template?.icon_key);
  const iconTheme =
    slice.kind === "family"
      ? "border-indigo-200/70 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
      : goalTemplateIconThemeFor(slice.personalGoal?.template?.slug ?? "custom").iconBadgeClass;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(slice.id)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
          : "border-border/70 bg-background text-muted-foreground hover:border-primary/25 hover:bg-muted/40",
        dimmed && "opacity-45",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? iconTheme : "border-border/70 bg-muted/30 text-muted-foreground",
        )}
      >
        <Icon className="size-2.5" aria-hidden />
      </span>
      <span className="truncate">{slice.label}</span>
    </button>
  );
}

const SUMMARY_PREVIEW_SLICES = [
  { id: "car", label: "Car fund", value: 24, fill: "#3b82f6", progress: 42 },
  { id: "travel", label: "Europe trip", value: 18, fill: "#14b8a6", progress: 18 },
  { id: "home", label: "Home down payment", value: 58, fill: "#10b981", progress: 65 },
] as const;

function GoalsSummaryPreviewContent() {
  const homeTheme = goalTemplateIconThemeFor("home");

  return (
    <div className="space-y-4 px-1 py-1">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
            {copy.goals.summaryTopPriorityLabel}
          </p>
          <GoalPriorityChip priority={2} className="h-6 px-2 text-[9px]" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border",
              homeTheme.iconBadgeClass,
            )}
          >
            <Home className="size-3.5" strokeWidth={2.1} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">Home down payment</p>
            <p className="truncate text-[10px] tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatInr(32_50_000, { compact: true })}</span>
              {" "}{copy.goals.detailOfTargetLabel}{" "}
              <span className="font-medium text-foreground">{formatInr(50_00_000, { compact: true })}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums leading-none text-foreground">65%</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">{copy.goals.progressLabel}</p>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/80">
          <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-primary to-primary/70" />
        </div>
      </div>

      <div className="relative mx-auto size-[11.5rem] shrink-0">
        <div className="pointer-events-none absolute inset-[18%] z-20 flex flex-col items-stretch justify-center gap-1.5">
          <div className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-card)] border border-border/70 bg-background/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
            <div className={cn("flex size-8 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border", goalTemplateIconThemeFor("car").iconBadgeClass)}>
              <Car className="size-3.5" strokeWidth={2.1} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-foreground">Car fund</p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {copy.goals.summarySliceCovered(42)}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 size-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...SUMMARY_PREVIEW_SLICES]}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {SUMMARY_PREVIEW_SLICES.map((slice) => (
                  <Cell key={slice.id} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-center">
          <GoalsSummaryCapacityBadge personalCount={3} familyCount={1} className="mt-0" />
        </div>
        <p className="text-center text-[10px] text-muted-foreground">{copy.goals.summarySelectGoalHint}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUMMARY_PREVIEW_SLICES.map((slice, index) => {
            const PreviewIcon =
              slice.id === "home" ? Home : slice.id === "car" ? Car : Plane;
            const iconTheme =
              slice.id === "home"
                ? goalTemplateIconThemeFor("home").iconBadgeClass
                : slice.id === "car"
                  ? goalTemplateIconThemeFor("car").iconBadgeClass
                  : "border-teal-200/70 bg-teal-50 text-teal-600 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300";

            return (
              <span
                key={slice.id}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
                  index === 0
                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                    : "border-border/70 bg-background text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    index === 0 ? iconTheme : "border-border/70 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <PreviewIcon className="size-2.5" aria-hidden />
                </span>
                <span className="max-w-[5.5rem] truncate">{slice.label}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GoalsSummaryLockedOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-3">
      <div className="flex max-w-[15rem] items-center gap-2.5 px-3 py-2.5 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
        <div className="relative shrink-0">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-3.5" strokeWidth={2.25} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <Plus className="size-2.5" strokeWidth={2.5} aria-hidden />
          </div>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-compact font-semibold text-foreground">{copy.goals.summaryLockedTitle}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {copy.goals.summaryEmptyDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoalsSummaryLockedEmptyState() {
  return (
    <div className="relative mt-4 min-h-[18rem] flex-1 overflow-hidden rounded-[var(--radius-control)] border border-dashed border-border/80">
      <div className="pointer-events-none select-none blur-[5px]">
        <GoalsSummaryPreviewContent />
      </div>
      <div className="pointer-events-none absolute inset-0 sip-chart-overlay" aria-hidden />
      <GoalsSummaryLockedOverlay />
    </div>
  );
}

export function GoalsSummaryPanel({ personalGoals, familyGoals, className }: GoalsSummaryPanelProps) {
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

  const chartData = useMemo(
    () => buildCombinedGoalSummaryChartData(personalGoals, familyGoals),
    [familyGoals, personalGoals],
  );
  const overallCoverage = useMemo(() => computeSummarySliceCoverage(chartData), [chartData]);
  const coveredCount = useMemo(() => countCoveredSummarySlices(chartData), [chartData]);
  const topPrioritySlice = useMemo(() => pickTopPrioritySummarySlice(chartData), [chartData]);
  const selectedSlice = useMemo(
    () => chartData.find((slice) => slice.id === selectedSliceId) ?? null,
    [chartData, selectedSliceId],
  );
  const hasGoals = chartData.length > 0;

  function handleSelectSlice(id: string) {
    setSelectedSliceId((current) => (current === id ? null : id));
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-[17.5rem] flex-col rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-none lg:min-h-[8.75rem]",
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">{copy.goals.summaryTitle}</h2>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{copy.goals.summarySubtitle}</p>
        {hasGoals ? (
          <GoalsSummaryCapacityBadge
            personalCount={personalGoals.length}
            familyCount={familyGoals.length}
          />
        ) : null}
      </div>

      {!hasGoals ? (
        <GoalsSummaryLockedEmptyState />
      ) : (
        <>
          {topPrioritySlice ? (
            <div className="mt-4">
              <TopPrioritySummaryCard slice={topPrioritySlice} />
            </div>
          ) : null}

          <div className="relative mx-auto mt-4 size-[11.5rem] shrink-0">
            <div className="pointer-events-none absolute inset-[18%] z-20 flex flex-col items-stretch justify-center gap-1.5">
              {selectedSlice ? (
                <GoalSummaryMiniCardFromSlice slice={selectedSlice} />
              ) : coveredCount > 0 ? (
                chartData
                  .filter((slice) => slice.covered)
                  .slice(0, 2)
                  .map((slice) => <GoalSummaryMiniCardFromSlice key={slice.id} slice={slice} />)
              ) : (
                <div className="flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">{overallCoverage}%</p>
                  <p className="text-[10px] text-muted-foreground">{copy.goals.summaryOverallCoverageLabel}</p>
                </div>
              )}
              {!selectedSlice && coveredCount > 2 ? (
                <p className="text-center text-[10px] font-medium text-muted-foreground">
                  {copy.goals.summaryMoreCovered(coveredCount - 2)}
                </p>
              ) : null}
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
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    onClick={(data) => {
                      const payload = data?.payload as GoalSummaryChartSlice | undefined;
                      if (payload?.id) handleSelectSlice(payload.id);
                    }}
                  >
                    {chartData.map((slice) => {
                      const isFocused = !selectedSliceId || selectedSliceId === slice.id;
                      return (
                        <Cell
                          key={slice.id}
                          fill={slice.fill}
                          stroke={selectedSliceId === slice.id ? "var(--primary)" : "var(--card)"}
                          strokeWidth={selectedSliceId === slice.id ? 2.5 : 2}
                          opacity={isFocused ? 1 : 0.28}
                          className="cursor-pointer"
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-center text-[11px] font-medium text-foreground">
              {copy.goals.summaryCoveredCount(coveredCount, chartData.length)}
              {coveredCount > 0
                ? ` · ${overallCoverage}% ${copy.goals.summaryOverallCoverageLabel.toLowerCase()}`
                : null}
            </p>
            <p className="text-center text-[10px] text-muted-foreground">{copy.goals.summarySelectGoalHint}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {chartData.map((slice) => (
                <GoalSummaryChartChip
                  key={slice.id}
                  slice={slice}
                  selected={selectedSliceId === slice.id}
                  dimmed={Boolean(selectedSliceId && selectedSliceId !== slice.id)}
                  onSelect={handleSelectSlice}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
