"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import {
  getDistributorJobCompensationSplit,
  type DistributorJobCompensation,
} from "@/lib/distributor-job-dashboard-data";
import { formatAum, formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type SplitSegmentId = "basic" | "performance" | "bonus";

type DistributorCompensationSplitCardProps = {
  compensation: DistributorJobCompensation;
  className?: string;
};

export function DistributorCompensationSplitCard({
  compensation,
  className,
}: DistributorCompensationSplitCardProps) {
  const trackGradientId = useId().replace(/:/g, "");
  const segments = useMemo(() => getDistributorJobCompensationSplit(compensation), [compensation]);
  const [activeSegments, setActiveSegments] = useState<Set<SplitSegmentId>>(
    () => new Set(segments.map((segment) => segment.id)),
  );

  const ringData = useMemo(
    () =>
      segments
        .filter((segment) => activeSegments.has(segment.id) && segment.value > 0)
        .map((segment) => ({
          id: segment.id,
          name: segment.label,
          value: segment.value,
          fill: segment.color,
        })),
    [activeSegments, segments],
  );

  const ringTotal = ringData.reduce((sum, segment) => sum + segment.value, 0);

  const centerDisplay = useMemo(() => {
    if (activeSegments.size === 1) {
      const only = segments.find((segment) => activeSegments.has(segment.id));
      if (only) {
        return {
          value: formatPortfolioMetricAmount(only.value),
          caption: only.label,
          title: formatAum(only.value),
        };
      }
    }

    return {
      value: formatPortfolioMetricAmount(compensation.takeHome),
      caption: "Take-home",
      title: formatAum(compensation.takeHome),
    };
  }, [activeSegments, compensation.takeHome, segments]);

  const toggleSegment = useCallback((id: SplitSegmentId) => {
    setActiveSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <article className={cn("distributor-compensation-split-card", className)}>
      <DistributorInsightCardHeader
        eyebrow={compensation.periodLabel}
        title="Compensation split"
        info="Fixed salary plus variable performance and spot bonus for this month"
      />

      <div className="distributor-compensation-split-card__body">
        <div
          className="distributor-compensation-split-card__chart"
          role="img"
          aria-label={`Take-home ${formatAum(compensation.takeHome)} for ${compensation.periodLabel}`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={trackGradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="90%"
                fill={`url(#${trackGradientId})`}
                stroke="none"
                isAnimationActive={false}
              />
              {ringTotal > 0 ? (
                <Pie
                  data={ringData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={ringData.length > 1 ? 2.5 : 0}
                  cornerRadius={5}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive
                >
                  {ringData.map((entry) => (
                    <Cell key={entry.id} fill={entry.fill} />
                  ))}
                </Pie>
              ) : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="distributor-compensation-split-card__chart-center">
            <p
              className="distributor-compensation-split-card__chart-value tabular-nums"
              title={centerDisplay.title}
            >
              {centerDisplay.value}
            </p>
            <p className="distributor-compensation-split-card__chart-caption">{centerDisplay.caption}</p>
          </div>
        </div>

        <div className="distributor-compensation-split-card__panel">
          <p className="distributor-compensation-split-card__panel-eyebrow">{compensation.periodLabel}</p>
          <ul className="distributor-compensation-split-card__breakdown">
            {segments.map((segment) => {
              const isActive = activeSegments.has(segment.id);
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    className={cn(
                      "distributor-compensation-split-card__breakdown-row",
                      isActive && "distributor-compensation-split-card__breakdown-row--active",
                    )}
                    aria-pressed={isActive}
                    onClick={() => toggleSegment(segment.id)}
                  >
                    <span
                      className="distributor-compensation-split-card__breakdown-dot"
                      style={{ background: segment.color }}
                      aria-hidden
                    />
                    <span className="distributor-compensation-split-card__breakdown-label">
                      {segment.label}
                    </span>
                    <span
                      className="distributor-compensation-split-card__breakdown-value tabular-nums"
                      title={formatAum(segment.value)}
                    >
                      {formatPortfolioMetricAmount(segment.value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
