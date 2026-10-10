"use client";

import { PieChart as PieChartIcon } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

export type YourClientsSummaryStats = {
  total: number;
  onboarded: number;
  compliant: number;
  invested: number;
};

type SummarySegmentId = "onboarded" | "compliant" | "invested";

const RING_DEFAULT = { size: 168, outer: 72, inner: 52 } as const;
const RING_COMPACT = { size: 108, outer: 46, inner: 32 } as const;
const RING_SQUARE = { size: 96, outer: 40, inner: 28 } as const;

const SEGMENT_COLORS: Record<SummarySegmentId, string> = {
  onboarded: "#7ec8a8",
  compliant: "#5a9fd4",
  invested: "#3d6b5e",
};

const ALL_SEGMENTS: SummarySegmentId[] = ["onboarded", "compliant", "invested"];

type DistributorClientsBookSummaryCardProps = {
  stats: YourClientsSummaryStats;
  className?: string;
  variant?: "default" | "compact" | "square";
};

export function DistributorClientsBookSummaryCard({
  stats,
  className,
  variant = "default",
}: DistributorClientsBookSummaryCardProps) {
  const isSquare = variant === "square";
  const isCompact = variant === "compact" || isSquare;
  const ring =
    variant === "square" ? RING_SQUARE : variant === "compact" ? RING_COMPACT : RING_DEFAULT;
  const trackGradientId = useId().replace(/:/g, "");

  const [activeSegments, setActiveSegments] = useState<Set<SummarySegmentId>>(
    () => new Set(ALL_SEGMENTS),
  );

  const segmentValues: Record<SummarySegmentId, number> = useMemo(
    () => ({
      onboarded: stats.onboarded,
      compliant: stats.compliant,
      invested: stats.invested,
    }),
    [stats.compliant, stats.invested, stats.onboarded],
  );

  const ringData = useMemo(
    () =>
      ALL_SEGMENTS.filter((id) => activeSegments.has(id) && segmentValues[id] > 0).map((id) => ({
        id,
        name:
          id === "onboarded" ? "Onboarded" : id === "compliant" ? "KYC compliant" : "Invested",
        value: segmentValues[id],
        fill: SEGMENT_COLORS[id],
      })),
    [activeSegments, segmentValues],
  );

  const ringTotal = ringData.reduce((sum, segment) => sum + segment.value, 0);

  const toggleSegment = useCallback((id: SummarySegmentId) => {
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

  const legendItems: { id: SummarySegmentId; label: string; value: number }[] = [
    { id: "onboarded", label: "Onboarded", value: stats.onboarded },
    { id: "compliant", label: "KYC", value: stats.compliant },
    { id: "invested", label: "Invested", value: stats.invested },
  ];

  return (
    <article
      className={cn(
        "distributor-clients-book-summary",
        isCompact && "distributor-clients-book-summary--compact",
        isSquare && "distributor-clients-book-summary--square",
        className,
      )}
      aria-label="Book summary"
    >
      {!isSquare ? (
        <div className="distributor-clients-book-summary__head">
          <span className="distributor-clients-book-summary__head-icon" aria-hidden>
            <PieChartIcon strokeWidth={2.25} />
          </span>
          <p className="distributor-clients-book-summary__head-title">Book summary</p>
        </div>
      ) : null}

      <div
        className="distributor-clients-book-summary__ring-wrap"
        role="img"
        aria-label={`${stats.onboarded} onboarded, ${stats.compliant} KYC compliant, ${stats.invested} invested of ${stats.total} clients`}
      >
        <div className="distributor-clients-book-summary__ring-chart">
          <ResponsiveContainer width="100%" height={ring.size} minWidth={0}>
            <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={trackGradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={ring.inner}
                outerRadius={ring.outer}
                fill={`url(#${trackGradientId})`}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="3 5"
                isAnimationActive={false}
              />
              {ringTotal > 0 ? (
                <Pie
                  data={ringData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={ring.inner}
                  outerRadius={ring.outer}
                  paddingAngle={4}
                  cornerRadius={6}
                  stroke="none"
                  isAnimationActive
                >
                  {ringData.map((entry) => (
                    <Cell key={entry.id} fill={entry.fill} />
                  ))}
                </Pie>
              ) : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="distributor-clients-book-summary__ring-center">
            <p className="distributor-clients-book-summary__ring-value tabular-nums">{stats.total}</p>
            <p className="distributor-clients-book-summary__ring-caption">Clients</p>
          </div>
        </div>

        <div className="distributor-clients-book-summary__legend-panel">
          {isSquare ? (
            <p className="distributor-clients-book-summary__legend-panel-label">Filter view</p>
          ) : null}
          <ul className="distributor-clients-book-summary__ring-legend">
            {legendItems.map((item) => {
              const isActive = activeSegments.has(item.id);
              if (isSquare) {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "distributor-clients-book-summary__legend-filter",
                        isActive && "distributor-clients-book-summary__legend-filter--active",
                      )}
                      aria-pressed={isActive}
                      onClick={() => toggleSegment(item.id)}
                    >
                      <span
                        className="distributor-clients-book-summary__legend-dot"
                        style={{ background: SEGMENT_COLORS[item.id] }}
                        aria-hidden
                      />
                      <span className="distributor-clients-book-summary__legend-filter-label">
                        {item.label}
                      </span>
                      <span className="distributor-clients-book-summary__legend-filter-value tabular-nums">
                        {item.value}
                      </span>
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <span
                    className="distributor-clients-book-summary__legend-dot"
                    style={{ background: SEGMENT_COLORS[item.id] }}
                  />
                  {item.label}
                  <span className="tabular-nums">{item.value}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
