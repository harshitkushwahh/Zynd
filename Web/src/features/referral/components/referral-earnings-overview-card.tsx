"use client";

import { useId, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ReferralListItem } from "@/features/referral/api/referral-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildEarningsSeries,
  hasReferralEarningsData,
  PLACEHOLDER_EARNINGS_SERIES,
  type EarningsPoint,
  type ReferralsPeriod,
} from "@/features/referral/lib/referral-display";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralEarningsOverviewCardProps = {
  referrals: ReferralListItem[];
};

const PERIOD_OPTIONS: { value: ReferralsPeriod; label: string }[] = [
  { value: "this_month", label: copy.referral.earningsPeriodThisMonth },
  { value: "last_3_months", label: copy.referral.earningsPeriodLast3Months },
  { value: "all_time", label: copy.referral.earningsPeriodAllTime },
];

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildPeriodSummary(points: EarningsPoint[]) {
  if (points.length === 0) {
    return { total: 0, growth: 0, growthPercent: "0.0" };
  }

  const total = points[points.length - 1]?.value ?? 0;
  const previous = points.length > 1 ? points[points.length - 2]?.value ?? 0 : 0;
  const growth = total - previous;
  const growthPercent =
    previous > 0 ? (((total - previous) / previous) * 100).toFixed(1) : growth > 0 ? "100.0" : "0.0";

  return { total, growth, growthPercent };
}

function getYAxisDomain(points: EarningsPoint[]): [number, number] {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return [min, max + range * 0.12];
}

type EarningsChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
};

function EarningsChartTooltip({ active, payload, label }: EarningsChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const value = Number(payload[0]?.value);
  if (!Number.isFinite(value)) return null;

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-2.5 py-1.5 shadow-zynd-mid">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-compact font-semibold text-foreground">{formatInr(value)}</p>
    </div>
  );
}

function renderEarningsTooltip(props: unknown) {
  return <EarningsChartTooltip {...(props as EarningsChartTooltipProps)} />;
}

const CHART_HEIGHT = 80;
const CHART_DOT_RADIUS = 4;
const CHART_DOT_STROKE = 2;
const CHART_EDGE_INSET = CHART_DOT_RADIUS + CHART_DOT_STROKE + 4;

function ReferralEarningsChart({
  points,
  interactive = true,
}: {
  points: EarningsPoint[];
  interactive?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const yDomain = useMemo(() => getYAxisDomain(points), [points]);
  const baseValue = yDomain[0];

  return (
    <div className="size-full [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={points}
          margin={{
            top: CHART_EDGE_INSET,
            right: CHART_EDGE_INSET,
            left: CHART_EDGE_INSET,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--zynd-emerald)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--zynd-emerald)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="label"
            hide
            padding={{ left: CHART_EDGE_INSET, right: CHART_EDGE_INSET }}
          />
          <YAxis hide domain={yDomain} width={0} />

          {interactive ? (
            <Tooltip
              cursor={{ stroke: "var(--zynd-emerald)", strokeOpacity: 0.25, strokeWidth: 1 }}
              content={renderEarningsTooltip}
            />
          ) : null}

          <Area
            type="monotone"
            dataKey="value"
            baseValue={baseValue}
            stroke="var(--zynd-emerald)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{
              r: CHART_DOT_RADIUS,
              fill: "var(--card)",
              stroke: "var(--zynd-emerald)",
              strokeWidth: CHART_DOT_STROKE,
            }}
            activeDot={
              interactive
                ? {
                    r: CHART_DOT_RADIUS + 1,
                    fill: "var(--card)",
                    stroke: "var(--zynd-emerald)",
                    strokeWidth: CHART_DOT_STROKE,
                  }
                : false
            }
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReferralEarningsLockedOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-2">
      <div
        className={cn(
          "flex max-w-full items-center gap-3 border border-border bg-card/95 px-3.5 py-3 shadow-zynd-mid backdrop-blur-sm sm:px-4",
          REFERRAL_CARD_RADIUS_CLASS
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
          <Lock className="size-4 text-success" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-compact font-semibold text-foreground">{copy.referral.earningsLockedTitle}</p>
          <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
            {copy.referral.earningsLockedSubtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReferralEarningsOverviewCard({ referrals }: ReferralEarningsOverviewCardProps) {
  const [period, setPeriod] = useState<ReferralsPeriod>("this_month");

  const hasEarnings = useMemo(() => hasReferralEarningsData(referrals), [referrals]);
  const realPoints = useMemo(() => buildEarningsSeries(referrals, period), [referrals, period]);
  const points = hasEarnings ? realPoints : PLACEHOLDER_EARNINGS_SERIES[period];
  const summary = useMemo(() => buildPeriodSummary(points), [points]);
  const periodLabel =
    PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    copy.referral.earningsPeriodThisMonth;
  const growthLabel =
    summary.growth > 0
      ? copy.referral.earningsGrowth
          .replace("{amount}", formatInr(summary.growth))
          .replace("{percent}", summary.growthPercent)
      : copy.referral.earningsNoGrowth;

  return (
    <section
      className={cn(
        "w-full max-w-full overflow-hidden border border-border bg-card p-3",
        REFERRAL_CARD_RADIUS_CLASS,
        "shadow-zynd-low"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-compact font-semibold text-foreground">{copy.referral.earningsOverviewTitle}</p>

        <Select
          value={period}
          onValueChange={(value) => setPeriod((value ?? "this_month") as ReferralsPeriod)}
        >
          <SelectTrigger className="h-7 min-w-[120px] rounded-[var(--radius-control)] border-border/70 bg-transparent px-2 text-caption shadow-none">
            <SelectValue>{periodLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative mt-1.5">
        <div
          className={cn(
            "flex items-end gap-3 transition-[filter]",
            !hasEarnings && "pointer-events-none select-none blur-[5px]"
          )}
        >
          <div
            className="min-w-0 flex-1 overflow-visible"
            style={{ height: CHART_HEIGHT }}
            aria-label={copy.referral.earningsChartAriaLabel}
            role="img"
            aria-hidden={!hasEarnings}
          >
            <ReferralEarningsChart points={points} interactive={hasEarnings} />
          </div>

          <div className="shrink-0 text-right leading-tight">
            <p className="text-h3 font-bold tracking-tight text-foreground">{formatInr(summary.total)}</p>
            <p className="mt-0.5 text-caption font-medium text-success">{growthLabel}</p>
          </div>
        </div>

        {!hasEarnings ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-background/25" aria-hidden />
            <ReferralEarningsLockedOverlay />
          </>
        ) : null}
      </div>
    </section>
  );
}
