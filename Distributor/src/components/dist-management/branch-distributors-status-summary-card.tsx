"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type BranchDistributorsStatusStats = {
  total: number;
  active: number;
  former: number;
  paused: number;
};

type StatusSegmentId = "active" | "former" | "paused";

const RING_SQUARE = { size: 96, outer: 40, inner: 28 } as const;

const SEGMENT_COLORS: Record<StatusSegmentId, string> = {
  active: "#3d6b5e",
  former: "#94a3b8",
  paused: "#d4a574",
};

const ALL_SEGMENTS: StatusSegmentId[] = ["active", "former", "paused"];

type BranchDistributorsStatusSummaryCardProps = {
  stats: BranchDistributorsStatusStats;
  className?: string;
};

export function BranchDistributorsStatusSummaryCard({
  stats,
  className,
}: BranchDistributorsStatusSummaryCardProps) {
  const trackGradientId = useId().replace(/:/g, "");

  const [activeSegments, setActiveSegments] = useState<Set<StatusSegmentId>>(
    () => new Set(ALL_SEGMENTS),
  );

  const segmentValues: Record<StatusSegmentId, number> = useMemo(
    () => ({
      active: stats.active,
      former: stats.former,
      paused: stats.paused,
    }),
    [stats.active, stats.former, stats.paused],
  );

  const ringData = useMemo(
    () =>
      ALL_SEGMENTS.filter((id) => activeSegments.has(id) && segmentValues[id] > 0).map((id) => ({
        id,
        name: id === "active" ? "Active" : id === "former" ? "Former" : "Paused",
        value: segmentValues[id],
        fill: SEGMENT_COLORS[id],
      })),
    [activeSegments, segmentValues],
  );

  const ringTotal = ringData.reduce((sum, segment) => sum + segment.value, 0);

  const toggleSegment = useCallback((id: StatusSegmentId) => {
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

  const legendItems: { id: StatusSegmentId; label: string; value: number }[] = [
    { id: "active", label: "Active", value: stats.active },
    { id: "former", label: "Former", value: stats.former },
    { id: "paused", label: "Paused", value: stats.paused },
  ];

  return (
    <article
      className={cn(
        "distributor-clients-book-summary distributor-clients-book-summary--square",
        className,
      )}
      aria-label={ZYND_MITRA_COPY.statusSummaryAria}
    >
      <div
        className="distributor-clients-book-summary__ring-wrap"
        role="img"
        aria-label={ZYND_MITRA_COPY.statusSummaryCounts(stats.active, stats.former, stats.paused, stats.total)}
      >
        <div className="distributor-clients-book-summary__ring-chart">
          <ResponsiveContainer width="100%" height={RING_SQUARE.size} minWidth={0}>
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
                innerRadius={RING_SQUARE.inner}
                outerRadius={RING_SQUARE.outer}
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
                  innerRadius={RING_SQUARE.inner}
                  outerRadius={RING_SQUARE.outer}
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
            <p className="distributor-clients-book-summary__ring-caption">Team</p>
          </div>
        </div>

        <div className="distributor-clients-book-summary__legend-panel">
          <p className="distributor-clients-book-summary__legend-panel-label">Filter view</p>
          <ul className="distributor-clients-book-summary__ring-legend">
            {legendItems.map((item) => {
              const isActive = activeSegments.has(item.id);
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
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
