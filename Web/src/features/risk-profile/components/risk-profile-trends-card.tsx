"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  RISK_PROFILE_CARD_CLASS,
  RISK_PROFILE_TREND_PLACEHOLDER_POINTS,
  RISK_PROFILE_TRENDS_MIN_PROFILES,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type TrendPoint = {
  label: string;
  score: number;
};

type RiskProfileTrendsCardProps = {
  trendPoints: TrendPoint[];
};

const CHART_HEIGHT = 72;
const CHART_MIN_WIDTH = 100;
/** Minimum horizontal space per assessment so dense histories scroll on the x-axis. */
const TREND_POINT_WIDTH = 28;

function getTrendChartWidth(pointCount: number) {
  return Math.max(CHART_MIN_WIDTH, pointCount * TREND_POINT_WIDTH);
}

type TrendsChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: ReadonlyArray<{ value?: number | string }>;
};

function TrendsChartTooltip({ active, label, payload }: TrendsChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value;
  if (value == null) return null;

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-2 py-1 shadow-zynd-low">
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
      <p className="text-[11px] font-semibold leading-tight tabular-nums text-foreground">
        {value}/100
      </p>
    </div>
  );
}

function TrendsLineChart({ data }: { data: TrendPoint[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(CHART_MIN_WIDTH);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const updateWidth = () => {
      setViewportWidth(Math.max(node.clientWidth, CHART_MIN_WIDTH));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return null;
  }

  const chartWidth = Math.max(viewportWidth, getTrendChartWidth(data.length));

  return (
    <div ref={viewportRef} className="min-w-full">
      <div
        className="h-[4.5rem] shrink-0 [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible"
        style={{ width: chartWidth }}
      >
        <LineChart
          width={chartWidth}
          height={CHART_HEIGHT}
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          dy={4}
          interval={0}
        />
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          content={<TrendsChartTooltip />}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          wrapperStyle={{ outline: "none", zIndex: 1 }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "var(--primary)" }}
          connectNulls
          isAnimationActive={false}
        />
        </LineChart>
      </div>
    </div>
  );
}

function TrendsLockPanel({ trendsMinProfiles }: { trendsMinProfiles: number }) {
  return (
    <div className="flex w-full max-w-[18rem] items-center gap-3 px-3.5 py-2.5 shadow-zynd-mid backdrop-blur-sm sm:px-4 sm:py-3 sip-lock-panel">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-compact font-semibold text-foreground">{copy.riskProfile.trendsLockedTitle}</p>
        <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
          {copy.riskProfile.trendsLockedDescription(trendsMinProfiles)}
        </p>
      </div>
    </div>
  );
}

export function RiskProfileTrendsCard({ trendPoints }: RiskProfileTrendsCardProps) {
  const riskProfile = useRiskProfileOptional();
  const trendsMinProfiles = riskProfile?.config.trends_min_profiles ?? RISK_PROFILE_TRENDS_MIN_PROFILES;
  const profileCount = riskProfile?.attemptState?.completed_count ?? 0;
  const isLocked = profileCount < trendsMinProfiles;
  const chartData = isLocked ? [...RISK_PROFILE_TREND_PLACEHOLDER_POINTS] : trendPoints;

  return (
    <section className={cn(RISK_PROFILE_CARD_CLASS, "p-3 sm:p-4")}>
      <h2 className="text-compact font-semibold text-foreground">{copy.riskProfile.trendsTitle}</h2>

      <div className="relative mt-2 min-h-[4.5rem]">
        <div className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          <div className={cn("w-max min-w-full", isLocked && "pointer-events-none select-none blur-[4px]")}>
            <TrendsLineChart data={chartData} />
          </div>
        </div>

        {isLocked ? (
          <>
            <div className="pointer-events-none absolute inset-0 risk-profile-gauge-overlay" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center px-3">
              <TrendsLockPanel trendsMinProfiles={trendsMinProfiles} />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
