"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { buildRiskAssessmentTrendSeries } from "@/lib/client-risk-trend-series";
import type { DistributorClientRiskAssessment } from "@/lib/distributor-types";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type ClientRiskProfileTrendsCardProps = {
  assessments: DistributorClientRiskAssessment[];
  current: DistributorClientRiskAssessment;
  className?: string;
};

type TrendTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number; payload?: { score: number; tier: string } }>;
};

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const score = Number(payload[0]?.value ?? point?.score ?? 0);
  const tierVisual = point?.tier ? resolveRiskTierVisual(point.tier) : null;
  return (
    <div className="distributor-client-risk-trends-card__tooltip">
      <p className="distributor-client-risk-trends-card__tooltip-score tabular-nums">{score}/100</p>
      {tierVisual ? (
        <span
          className="distributor-client-risk-trends-card__tooltip-badge"
          style={{
            color: tierVisual.gaugeColor,
            background: `color-mix(in srgb, ${tierVisual.gaugeColor} 22%, #0a0a0a)`,
            borderColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 45%, transparent)`,
          }}
        >
          {tierVisual.label}
        </span>
      ) : null}
    </div>
  );
}

function renderTrendTooltip(props: unknown) {
  return <TrendTooltip {...(props as TrendTooltipProps)} />;
}

function chartDomain(points: { score: number }[]): [number, number] {
  const values = points.map((point) => point.score);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const pad = Math.max(4, (max - min) * 0.18);
  return [Math.max(0, min - pad), Math.min(100, max + pad)];
}

export function ClientRiskProfileTrendsCard({
  assessments,
  current,
  className,
}: ClientRiskProfileTrendsCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const gradientId = useId().replace(/:/g, "");
  const series = useMemo(
    () =>
      buildRiskAssessmentTrendSeries(assessments, {
        excludeAssessmentId: current.assessmentId,
      }),
    [assessments, current.assessmentId],
  );
  const domain = useMemo(() => chartDomain(series), [series]);

  if (series.length === 0) return null;

  return (
    <article className={cn("distributor-client-risk-trends-card", className)}>
      <DistributorInsightCardHeader
        eyebrow={copy.pastAssessmentsTitle}
        title={copy.pastAssessmentTrendsTitle}
        titleAs="p"
      />

      <div
        className="distributor-client-risk-trends-card__chart"
        role="img"
        aria-label="Risk score trend across past assessments"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis domain={domain} hide />
            <Tooltip
              content={renderTrendTooltip}
              cursor={{
                stroke: "color-mix(in srgb, var(--primary) 45%, transparent)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: "var(--primary)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
