"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarDays, CircleCheck, PenLine, Sparkles, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import type { GoalCalculatorResult } from "@/features/goals/api/goals-api";
import { formatGoalPanelInr } from "@/features/goals/lib/goal-display-format";
import {
  GoalTemplateIllustrationImage,
} from "@/features/goals/components/goal-template-illustration-image";
import {
  goalTemplateIconThemeFor,
  goalTemplateTaglineFor,
  resolveGoalTemplateIllustrationUrl,
  type GoalTemplateTheme,
} from "@/features/goals/lib/goal-template-meta";
import { getGoalTemplateIcon } from "@/features/goals/lib/goal-template-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

/** Shared growth colour for plan amounts across all predefined goal dialogs. */
const GOAL_PLAN_GROWTH_VALUE_CLASS = "text-emerald-600 dark:text-emerald-300";

export type GoalTemplatePlanIllustration = {
  slug: string;
  iconKey?: string | null;
  imageUrl?: string | null;
};

export type GoalCustomSidebarTitle = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputId?: string;
};

type GoalCalculatorResultsProps = {
  result: GoalCalculatorResult | null;
  loading?: boolean;
  variant?: "grid" | "stack" | "sidebar";
  accentTheme?: GoalTemplateTheme | null;
  templateIllustration?: GoalTemplatePlanIllustration | null;
  customSidebarTitle?: GoalCustomSidebarTitle | null;
  className?: string;
};

type SidebarMetricConfig = {
  label: string;
  value: string;
};

function ResultMetric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-border/60 bg-background/80 px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-semibold tabular-nums text-foreground",
          emphasize ? "text-lg" : "text-sm",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function GoalOnTrackBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-control)] border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10",
        className,
      )}
      role="status"
    >
      <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-snug text-emerald-800 dark:text-emerald-200">
          {copy.goals.calculatorOnTrackTitle}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-emerald-700/90 dark:text-emerald-300/90">
          {copy.goals.calculatorOnTrackDescription}
        </p>
      </div>
    </div>
  );
}

function PlanIllustrationHeader({
  illustration,
  accentTheme,
}: {
  illustration: GoalTemplatePlanIllustration;
  accentTheme: GoalTemplateTheme | null;
}) {
  const Icon = getGoalTemplateIcon(illustration.iconKey) as LucideIcon;
  const theme = goalTemplateIconThemeFor(illustration.slug);
  const tagline = goalTemplateTaglineFor(illustration.slug);
  const illustrationUrl = resolveGoalTemplateIllustrationUrl(illustration.slug, illustration.imageUrl);

  if (illustrationUrl) {
    return (
      <div className="w-full shrink-0 border-b border-border/70 px-4 pb-4 pt-4 sm:px-5">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-background shadow-sm">
          <div className="relative aspect-[4/3] w-full">
            <GoalTemplateIllustrationImage
              src={illustrationUrl}
              priority
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-background via-background/75 to-transparent"
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-3.5 pt-8 text-center">
              <div className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-white shadow-sm dark:bg-background">
                <Icon
                  className={cn(
                    "size-4",
                    accentTheme?.accentIconClass ?? "text-muted-foreground",
                  )}
                  strokeWidth={2.1}
                  aria-hidden
                />
              </div>
              <p className="mt-2 max-w-[15rem] text-[11px] font-medium leading-snug text-muted-foreground">
                {tagline}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full shrink-0 border-b border-border/70 bg-muted/10">
      <div className="flex w-full flex-col items-center px-5 py-5 text-center sm:px-6 sm:py-6">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-[var(--radius-card)] border shadow-sm",
            theme.iconBadgeClass,
          )}
        >
          <Icon className="size-6" strokeWidth={2} aria-hidden />
        </div>
        <p
          className={cn(
            "mt-3 max-w-[16rem] text-sm font-medium leading-snug text-foreground",
            accentTheme?.accentTextClass,
          )}
        >
          {tagline}
        </p>
      </div>
    </div>
  );
}

function CustomGoalNameSidebarHeader({
  title,
  accentTheme,
}: {
  title: GoalCustomSidebarTitle;
  accentTheme: GoalTemplateTheme | null;
}) {
  const inputId = title.inputId ?? "goal-custom-title";

  return (
    <div className="w-full shrink-0 border-b border-border/70 px-4 py-4 sm:px-5">
      <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/15 p-4 shadow-sm">
        <Label htmlFor={inputId} className="text-compact font-semibold text-foreground">
          {copy.goals.titleLabel}
        </Label>
        <div className="relative mt-2.5">
          <PenLine
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
              accentTheme?.accentIconClass ?? "text-muted-foreground",
            )}
            aria-hidden
          />
          <Input
            id={inputId}
            value={title.value}
            onChange={(event) => title.onChange(event.target.value)}
            placeholder={copy.goals.titlePlaceholder}
            maxLength={80}
            className={cn("h-10 pl-10", accentTheme?.inputFocusClass)}
            aria-invalid={Boolean(title.error)}
          />
        </div>
        {title.error ? <FieldMessage message={title.error} className="mt-2" /> : null}
      </div>
    </div>
  );
}

function SidebarPlanDurationCard({
  label,
  months,
  loading,
  accentTheme,
}: {
  label: string;
  months: number;
  loading: boolean;
  accentTheme: GoalTemplateTheme | null;
}) {
  const accentIconClass = accentTheme?.accentIconClass ?? "text-primary";
  const monthUnit = months === 1 ? "month" : "months";

  return (
    <div className="border-t border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/15 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] border border-border/60 bg-background">
            <CalendarDays className={cn("size-3.5", accentIconClass)} aria-hidden />
          </div>
          <p className="truncate text-[11px] font-medium text-foreground">{label}</p>
        </div>

        {loading ? (
          <Skeleton className="h-7 w-24 shrink-0 rounded-[var(--radius-control)]" aria-hidden />
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "h-auto shrink-0 gap-1 px-2.5 py-1",
              "border-emerald-200/90 bg-emerald-50/95 text-emerald-700",
              "dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300",
            )}
            title={copy.goals.monthsLabel(months)}
          >
            <span className="text-sm font-bold tabular-nums leading-none">{months}</span>
            <span className="text-[10px] font-semibold tracking-wide opacity-90">{monthUnit}</span>
          </Badge>
        )}
      </div>
    </div>
  );
}

function SidebarPlanMetricsSkeleton({ accentTheme }: { accentTheme: GoalTemplateTheme | null }) {
  const accentIconClass = accentTheme?.accentIconClass ?? "text-primary";

  return (
    <div className="min-h-[16.5rem]" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Sparkles className={cn("size-4 shrink-0", accentIconClass)} aria-hidden />
        <p className="text-sm font-semibold text-foreground">{copy.goals.calculatorPlanTitle}</p>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-start gap-2.5">
          <Wallet className={cn("mt-0.5 size-4 shrink-0", accentIconClass)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
              {copy.goals.requiredSipLabel}
            </p>
            <Skeleton className="mt-1.5 h-8 w-28" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border/70 divide-x divide-border/70">
        <div className="min-w-0 px-4 py-3">
          <p className="truncate text-[10px] leading-snug text-muted-foreground">
            {copy.goals.requiredLumpsumLabel}
          </p>
          <Skeleton className="mt-1.5 h-5 w-16" />
        </div>
        <div className="min-w-0 px-4 py-3">
          <p className="truncate text-[10px] leading-snug text-muted-foreground">
            {copy.goals.projectedValueLabel}
          </p>
          <Skeleton className="mt-1.5 h-5 w-16" />
        </div>
      </div>

      <SidebarPlanDurationCard
        label={copy.goals.durationLabel}
        months={0}
        loading
        accentTheme={accentTheme}
      />
    </div>
  );
}

function SidebarPlanMetricValue({
  value,
  loading,
  valueClassName,
  skeletonClassName,
}: {
  value: string;
  loading: boolean;
  valueClassName?: string;
  skeletonClassName: string;
}) {
  if (loading) {
    return <Skeleton className={skeletonClassName} aria-hidden />;
  }

  return (
    <p
      className={cn("mt-1 truncate font-semibold tabular-nums text-foreground", valueClassName)}
      title={value}
    >
      {value}
    </p>
  );
}

function SidebarPlanMetrics({
  items,
  durationMonths,
  accentTheme,
  goalCovered,
  loading,
}: {
  items: SidebarMetricConfig[];
  durationMonths: number;
  accentTheme: GoalTemplateTheme | null;
  goalCovered: boolean;
  loading: boolean;
}) {
  const [sipItem, lumpsumItem, projectedItem, durationItem] = items;
  const accentIconClass = accentTheme?.accentIconClass ?? "text-primary";

  return (
    <div className="min-h-[16.5rem]" aria-busy={loading}>
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Sparkles className={cn("size-4 shrink-0", accentIconClass)} aria-hidden />
        <p className="text-sm font-semibold text-foreground">{copy.goals.calculatorPlanTitle}</p>
      </div>

      {goalCovered && !loading ? (
        <div className="border-b border-border/70 p-3">
          <GoalOnTrackBadge />
        </div>
      ) : null}

      <div className="px-4 py-4">
        <div className="flex items-start gap-2.5">
          <Wallet className={cn("mt-0.5 size-4 shrink-0", accentIconClass)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
              {sipItem.label}
            </p>
            <SidebarPlanMetricValue
              value={sipItem.value}
              loading={loading}
              valueClassName={cn("mt-1 text-2xl leading-none", GOAL_PLAN_GROWTH_VALUE_CLASS)}
              skeletonClassName="mt-1.5 h-8 w-28"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border/70 divide-x divide-border/70">
        <div className="min-w-0 px-4 py-3">
          <p className="truncate text-[10px] leading-snug text-muted-foreground">{lumpsumItem.label}</p>
          <SidebarPlanMetricValue
            value={lumpsumItem.value}
            loading={loading}
            valueClassName={cn("text-sm", GOAL_PLAN_GROWTH_VALUE_CLASS)}
            skeletonClassName="mt-1.5 h-5 w-16"
          />
        </div>
        <div className="min-w-0 px-4 py-3">
          <p className="truncate text-[10px] leading-snug text-muted-foreground">{projectedItem.label}</p>
          <SidebarPlanMetricValue
            value={projectedItem.value}
            loading={loading}
            valueClassName={cn("text-sm", GOAL_PLAN_GROWTH_VALUE_CLASS)}
            skeletonClassName="mt-1.5 h-5 w-16"
          />
        </div>
      </div>

      <SidebarPlanDurationCard
        label={durationItem.label}
        months={durationMonths}
        loading={loading}
        accentTheme={accentTheme}
      />
    </div>
  );
}

function SidebarUnifiedPlanCard({
  result,
  loading,
  accentTheme,
  templateIllustration,
  customSidebarTitle,
  className,
}: {
  result: GoalCalculatorResult | null;
  loading: boolean;
  accentTheme: GoalTemplateTheme | null;
  templateIllustration: GoalTemplatePlanIllustration | null;
  customSidebarTitle?: GoalCustomSidebarTitle | null;
  className?: string;
}) {
  const goalCovered = result ? result.required_monthly_sip_inr <= 0 : false;

  const sidebarItems: SidebarMetricConfig[] = result
    ? [
        {
          label: copy.goals.requiredSipLabel,
          value: formatGoalPanelInr(result.required_monthly_sip_inr),
        },
        {
          label: copy.goals.requiredLumpsumLabel,
          value: formatGoalPanelInr(result.required_lumpsum_inr),
        },
        {
          label: copy.goals.projectedValueLabel,
          value: formatGoalPanelInr(result.projected_value_inr),
        },
        {
          label: copy.goals.durationLabel,
          value: copy.goals.monthsLabel(result.duration_months),
        },
      ]
    : [];

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background", className)}>
      {customSidebarTitle ? (
        <CustomGoalNameSidebarHeader title={customSidebarTitle} accentTheme={accentTheme} />
      ) : templateIllustration ? (
        <PlanIllustrationHeader illustration={templateIllustration} accentTheme={accentTheme} />
      ) : null}

      {loading && !result ? (
        <SidebarPlanMetricsSkeleton accentTheme={accentTheme} />
      ) : result ? (
        <SidebarPlanMetrics
          items={sidebarItems}
          durationMonths={result.duration_months}
          accentTheme={accentTheme}
          goalCovered={goalCovered}
          loading={loading}
        />
      ) : (
        <div className="flex min-h-[16.5rem] flex-1 flex-col px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn("size-4 shrink-0", accentTheme?.accentIconClass ?? "text-primary")}
              aria-hidden
            />
            <p className="text-sm font-semibold text-foreground">{copy.goals.calculatorPlanTitle}</p>
          </div>
          <p className="mt-3 text-compact leading-relaxed text-muted-foreground">
            {copy.goals.calculatorResultsHint}
          </p>
        </div>
      )}
    </div>
  );
}

export function GoalCalculatorResults({
  result,
  loading = false,
  variant = "grid",
  accentTheme = null,
  templateIllustration = null,
  customSidebarTitle = null,
  className,
}: GoalCalculatorResultsProps) {
  if (variant === "sidebar") {
    return (
      <SidebarUnifiedPlanCard
        result={result}
        loading={loading}
        accentTheme={accentTheme}
        templateIllustration={templateIllustration}
        customSidebarTitle={customSidebarTitle}
        className={className}
      />
    );
  }

  if (loading && !result) {
    return (
      <p className={cn("text-compact text-muted-foreground", className)}>
        {copy.goals.calculatorLoading}
      </p>
    );
  }

  if (!result) {
    return (
      <p className={cn("text-compact leading-relaxed text-muted-foreground", className)}>
        {copy.goals.calculatorResultsHint}
      </p>
    );
  }

  const goalCovered = result.required_monthly_sip_inr <= 0;

  const items = [
    {
      label: copy.goals.requiredSipLabel,
      value: formatGoalPanelInr(result.required_monthly_sip_inr),
      emphasize: true,
    },
    {
      label: copy.goals.requiredLumpsumLabel,
      value: formatGoalPanelInr(result.required_lumpsum_inr),
    },
    {
      label: copy.goals.projectedValueLabel,
      value: formatGoalPanelInr(result.projected_value_inr),
    },
    {
      label: copy.goals.durationLabel,
      value: copy.goals.monthsLabel(result.duration_months),
    },
  ];

  return (
    <div
      className={cn(
        variant === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3",
        loading && "opacity-70",
        className,
      )}
    >
      {goalCovered ? <GoalOnTrackBadge className={variant === "grid" ? "sm:col-span-2" : undefined} /> : null}
      {items.map((item) => (
        <ResultMetric
          key={item.label}
          label={item.label}
          value={item.value}
          emphasize={item.emphasize}
        />
      ))}
    </div>
  );
}
