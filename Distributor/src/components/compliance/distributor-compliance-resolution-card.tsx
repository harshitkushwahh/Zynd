"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import {
  getDistributorComplianceResolutionStats,
  type DistributorComplianceQueueRow,
} from "@/lib/dummy/distributor-compliance";
import { cn } from "@/lib/utils";

const RESOLVED_COLOR = "#3d6b5e";
const PENDING_COLOR = "#f97316";

type ResolutionSegmentId = "pending" | "resolved";

const ALL_SEGMENTS: ResolutionSegmentId[] = ["pending", "resolved"];

const SEGMENT_COLORS: Record<ResolutionSegmentId, string> = {
  pending: PENDING_COLOR,
  resolved: RESOLVED_COLOR,
};

type DistributorComplianceResolutionCardProps = {
  rows: DistributorComplianceQueueRow[];
  className?: string;
};

export function DistributorComplianceResolutionCard({
  rows,
  className,
}: DistributorComplianceResolutionCardProps) {
  const trackGradientId = useId().replace(/:/g, "");
  const stats = useMemo(() => getDistributorComplianceResolutionStats(rows), [rows]);
  const [activeSegments, setActiveSegments] = useState<Set<ResolutionSegmentId>>(
    () => new Set(ALL_SEGMENTS),
  );

  const segmentValues: Record<ResolutionSegmentId, number> = useMemo(
    () => ({
      pending: stats.pending,
      resolved: stats.resolved,
    }),
    [stats.pending, stats.resolved],
  );

  const ringData = useMemo(
    () =>
      ALL_SEGMENTS.filter((id) => activeSegments.has(id) && segmentValues[id] > 0).map((id) => ({
        id,
        name: id === "pending" ? "Pending" : "Resolved",
        value: segmentValues[id],
        fill: SEGMENT_COLORS[id],
      })),
    [activeSegments, segmentValues],
  );

  const ringTotal = ringData.reduce((sum, segment) => sum + segment.value, 0);

  const centerDisplay = useMemo(() => {
    if (activeSegments.size === 1) {
      const onlySegment = ALL_SEGMENTS.find((id) => activeSegments.has(id));
      if (onlySegment === "pending") {
        return { value: String(stats.pending), caption: "Pending" };
      }
      if (onlySegment === "resolved") {
        return { value: String(stats.resolved), caption: "Resolved" };
      }
    }

    return { value: `${stats.resolvedPct}%`, caption: "Resolved" };
  }, [activeSegments, stats.pending, stats.resolved, stats.resolvedPct]);

  const toggleSegment = useCallback((id: ResolutionSegmentId) => {
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

  const legendItems: Array<{ id: ResolutionSegmentId; label: string; value: number }> = [
    { id: "pending", label: "Pending", value: stats.pending },
    { id: "resolved", label: "Resolved", value: stats.resolved },
  ];

  const ringAriaLabel =
    activeSegments.size === ALL_SEGMENTS.length
      ? `${stats.resolvedPct} percent of issues resolved this month`
      : activeSegments.has("pending") && !activeSegments.has("resolved")
        ? `${stats.pending} pending issues this month`
        : `${stats.resolved} resolved issues this month`;

  return (
    <article
      className={cn("distributor-compliance-resolution-card", className)}
      aria-label={`${stats.resolved} issues resolved and ${stats.pending} pending`}
    >
      <div className="distributor-compliance-resolution-card__head">
        <DistributorInsightCardHeader
          eyebrow="Compliance queue"
          title="Issue resolution"
          info="Share of compliance issues resolved vs still pending this month"
          className="distributor-compliance-resolution-card__header"
        />
        <p className="distributor-insight-card-summary-badge">
          <span className="tabular-nums">
            {stats.resolved} of {stats.total}
          </span>{" "}
          resolved this month
        </p>
      </div>

      <div className="distributor-compliance-resolution-card__body">
        <div
          className="distributor-compliance-resolution-card__chart"
          role="img"
          aria-label={ringAriaLabel}
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
          <div className="distributor-compliance-resolution-card__chart-center">
            <p className="distributor-compliance-resolution-card__chart-value tabular-nums">
              {centerDisplay.value}
            </p>
            <p className="distributor-compliance-resolution-card__chart-caption">
              {centerDisplay.caption}
            </p>
          </div>
        </div>

        <div className="distributor-compliance-resolution-card__panel">
          <p className="distributor-compliance-resolution-card__panel-eyebrow">This month</p>
          <ul className="distributor-compliance-resolution-card__breakdown">
            {legendItems.map((item) => {
              const isActive = activeSegments.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "distributor-compliance-resolution-card__breakdown-row",
                      isActive && "distributor-compliance-resolution-card__breakdown-row--active",
                    )}
                    aria-pressed={isActive}
                    onClick={() => toggleSegment(item.id)}
                  >
                    <span
                      className="distributor-compliance-resolution-card__breakdown-dot"
                      style={{ background: SEGMENT_COLORS[item.id] }}
                      aria-hidden
                    />
                    <span className="distributor-compliance-resolution-card__breakdown-label">
                      {item.label}
                    </span>
                    <span className="distributor-compliance-resolution-card__breakdown-value tabular-nums">
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
