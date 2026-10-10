"use client";

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import {
  SUPPORT_OVERVIEW_PERFORMANCE,
  SUPPORT_OVERVIEW_SLA,
} from "@/lib/support-overview-analytics-data";

function PerformanceStatCard({
  eyebrow,
  title,
  value,
  trendPct,
  trailing,
}: {
  eyebrow: string;
  title: string;
  value: string;
  trendPct: number;
  trailing?: ReactNode;
}) {
  return (
    <article className="distributor-operations-insight-card min-h-[10.5rem]">
      <DistributorInsightCardHeader eyebrow={eyebrow} title={title} titleAs="p" />
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="distributor-operations-insight-card__value tabular-nums">{value}</p>
        {trailing}
      </div>
      <div className="mt-2">
        <DistributorGrowthBadge value={trendPct} suffix=" vs last week" />
      </div>
    </article>
  );
}

export function SupportOverviewPerformanceCards() {
  const sla = SUPPORT_OVERVIEW_SLA;
  const performance = SUPPORT_OVERVIEW_PERFORMANCE;

  const gaugeData = useMemo(
    () => [
      { name: "Within SLA", value: sla.compliancePct, fill: "var(--chart-2)" },
      { name: "Remaining", value: 100 - sla.compliancePct, fill: "color-mix(in srgb, var(--muted) 80%, transparent)" },
    ],
    [sla.compliancePct],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="distributor-operations-team-card min-h-[10.5rem]">
        <DistributorInsightCardHeader eyebrow="Service level" title="SLA compliance" titleAs="p" />
        <div className="mt-2 flex items-center gap-4">
          <div className="relative size-[5.5rem] shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={gaugeData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={44}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {gaugeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-compact font-semibold tabular-nums">{sla.compliancePct}%</span>
              <span className="text-micro text-muted-foreground">Within SLA</span>
            </div>
          </div>
          <ul className="min-w-0 space-y-2 text-caption">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[var(--chart-2)]" aria-hidden />
              <span className="text-muted-foreground">{sla.resolvedWithinSla} resolved within SLA</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-destructive" aria-hidden />
              <span className="text-muted-foreground">{sla.breachedSla} breached SLA</span>
            </li>
          </ul>
        </div>
      </article>

      <PerformanceStatCard
        eyebrow="Responsiveness"
        title="First response time"
        value={performance.firstResponse.label}
        trendPct={performance.firstResponse.trendPct}
      />
      <PerformanceStatCard
        eyebrow="Resolution"
        title="Average resolution time"
        value={performance.avgResolution.label}
        trendPct={performance.avgResolution.trendPct}
      />
      <PerformanceStatCard
        eyebrow="Quality"
        title="Customer satisfaction"
        value={performance.satisfaction.label}
        trendPct={performance.satisfaction.trendPct}
        trailing={<Star className="size-5 text-warning" fill="currentColor" aria-hidden />}
      />
    </div>
  );
}
