"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Car, Home, Lock, Plane, Plus, User, Users } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";

import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/features/goals/api/goals-api";
import { GoalPriorityDot } from "@/features/goals/components/goal-priority-badge-picker";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { goalTemplateIconThemeFor } from "@/features/goals/lib/goal-template-meta";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
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

function GoalsSummaryChartCenter({ totalGoals }: { totalGoals: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 text-center">
      <p className="text-xl font-semibold tabular-nums leading-none text-foreground">{totalGoals}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {copy.goals.summaryChartCenterGoalsLabel(totalGoals)}
      </p>
    </div>
  );
}

function inferGoalTemplateSlugFromTitle(title: string): string | null {
  const haystack = title.toLowerCase();
  if (haystack.includes("car")) return "car";
  if (haystack.includes("home") || haystack.includes("house")) return "home";
  if (haystack.includes("travel") || haystack.includes("trip")) return "travel";
  if (haystack.includes("wedding") || haystack.includes("marriage")) return "wedding";
  if (haystack.includes("education") || haystack.includes("college")) return "education";
  if (haystack.includes("retire")) return "retirement";
  return null;
}

function resolveSummarySliceSlug(slice: GoalSummaryChartSlice): string {
  if (slice.personalGoal?.template?.slug) return slice.personalGoal.template.slug;
  if (slice.familyGoal?.tag) return slice.familyGoal.tag.toLowerCase();
  return inferGoalTemplateSlugFromTitle(slice.label) ?? (slice.kind === "family" ? "family" : "custom");
}

function resolveSummarySliceIconKey(slice: GoalSummaryChartSlice): string {
  if (slice.personalGoal?.template?.icon_key) return slice.personalGoal.template.icon_key;
  const slug = resolveSummarySliceSlug(slice);
  const iconKeyBySlug: Record<string, string> = {
    car: "car",
    travel: "plane",
    education: "graduation-cap",
    wedding: "heart",
    home: "home",
    retirement: "sunset",
    family: "target",
  };
  return iconKeyBySlug[slug] ?? "target";
}

function SummaryTopPriorityProgressRing({ progress }: { progress: number }) {
  const size = 40;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedProgress / 100);

  return (
    <div
      className="relative flex size-10 shrink-0 items-center justify-center"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedProgress}
      aria-label={`${clampedProgress.toFixed(0)}% ${copy.goals.progressLabel.toLowerCase()}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
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
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums leading-none text-foreground">
        {clampedProgress.toFixed(0)}%
      </span>
    </div>
  );
}

function goalSummaryIconColorClass(themeClass: string) {
  return themeClass
    .split(" ")
    .filter((token) => token.startsWith("text-") || token.startsWith("dark:text-"))
    .join(" ");
}

const FAMILY_GROUP_AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
];

function FamilyGroupCircleAvatar({
  title,
  avatarUrl,
}: {
  title: string;
  avatarUrl?: string | null;
}) {
  const colorIndex =
    title.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    FAMILY_GROUP_AVATAR_COLORS.length;

  return (
    <div
      className={cn(
        "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
        FAMILY_GROUP_AVATAR_COLORS[colorIndex],
      )}
      title={title}
      aria-label={title}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[8px] font-semibold leading-none">{familyMemberInitials(title)}</span>
      )}
    </div>
  );
}

function TopPrioritySummaryCardContent({
  priority,
  title,
  familyGroup,
  progress,
  iconKey,
  templateSlug,
}: {
  priority: number;
  title: string;
  familyGroup?: { title: string; avatarUrl?: string | null } | null;
  progress: number;
  iconKey: string;
  templateSlug: string;
}) {
  const Icon = getGoalTemplateIcon(iconKey);
  const iconTheme = goalTemplateIconThemeFor(templateSlug);
  const iconColorClass = goalSummaryIconColorClass(iconTheme.headerIconClass ?? iconTheme.iconBadgeClass);

  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border/80 bg-background/95 p-2">
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColorClass)} strokeWidth={2.1} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.goals.summaryTopPriorityLabel}
          </p>
          <GoalPriorityDot priority={priority} />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold leading-tight text-foreground">{title}</p>
          {familyGroup ? (
            <FamilyGroupCircleAvatar title={familyGroup.title} avatarUrl={familyGroup.avatarUrl} />
          ) : null}
        </div>
      </div>

      <SummaryTopPriorityProgressRing progress={progress} />
    </div>
  );
}

function TopPrioritySummaryCard({ slice }: { slice: GoalSummaryChartSlice }) {
  const href = goalSummarySliceHref(slice);
  const priority =
    slice.personalGoal?.priority ?? slice.familyGoal?.priority ?? 3;
  const title = slice.personalGoal?.title ?? slice.familyGoal?.title ?? slice.label;
  const familyGroup =
    slice.kind === "family" && slice.familyGoal
      ? {
          title: slice.familyGoal.groupTitle,
          avatarUrl: slice.familyGoal.groupAvatarUrl,
        }
      : null;
  const templateSlug = resolveSummarySliceSlug(slice);
  const iconKey = resolveSummarySliceIconKey(slice);

  const card = (
    <TopPrioritySummaryCardContent
      priority={priority}
      title={title}
      familyGroup={familyGroup}
      progress={slice.progress}
      iconKey={iconKey}
      templateSlug={templateSlug}
    />
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
  const templateSlug = resolveSummarySliceSlug(slice);
  const Icon = getGoalTemplateIcon(resolveSummarySliceIconKey(slice));
  const iconTheme = goalTemplateIconThemeFor(templateSlug).iconBadgeClass;

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
  return (
    <div className="space-y-4 px-1 py-1">
      <TopPrioritySummaryCardContent
        priority={2}
        title="Home down payment"
        progress={65}
        iconKey="home"
        templateSlug="home"
      />

      <div className="relative mx-auto size-[11.5rem] shrink-0">
        <div className="pointer-events-none absolute inset-[18%] z-20 flex items-center justify-center">
          <GoalsSummaryChartCenter totalGoals={SUMMARY_PREVIEW_SLICES.length} />
        </div>

        <div className="relative z-10 size-full">
          <RechartsMeasuredContainer width="100%" height="100%" minWidth={0}>
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
          </RechartsMeasuredContainer>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-center">
          <GoalsSummaryCapacityBadge personalCount={3} familyCount={1} className="mt-0" />
        </div>
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
    <div className="relative mt-2.5 min-h-[18rem] flex-1 overflow-hidden rounded-[var(--radius-control)] border border-dashed border-border/80">
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
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-foreground">{copy.goals.summaryTitle}</h2>
        {hasGoals ? (
          <GoalsSummaryCapacityBadge
            personalCount={personalGoals.length}
            familyCount={familyGoals.length}
            className="mt-0"
          />
        ) : null}
      </div>

      {!hasGoals ? (
        <GoalsSummaryLockedEmptyState />
      ) : (
        <>
          {topPrioritySlice ? (
            <div className="mt-2.5">
              <TopPrioritySummaryCard slice={topPrioritySlice} />
            </div>
          ) : null}

          <div className="relative mx-auto mt-3 size-[11.5rem] shrink-0">
            <div className="pointer-events-none absolute inset-[18%] z-20 flex items-center justify-center">
              <GoalsSummaryChartCenter totalGoals={chartData.length} />
            </div>

            <div className="relative z-10 size-full">
              <RechartsMeasuredContainer width="100%" height="100%" minWidth={0}>
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
              </RechartsMeasuredContainer>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-center text-[11px] text-muted-foreground">
              {copy.goals.summaryCoveredCount(coveredCount, chartData.length)}
              {coveredCount > 0
                ? ` · ${overallCoverage}% ${copy.goals.summaryOverallCoverageLabel.toLowerCase()}`
                : null}
            </p>
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
