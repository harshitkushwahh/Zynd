"use client";

import { useMemo } from "react";
import { Goal, Target } from "lucide-react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientGoalsListCard } from "@/components/clients/client-goals-list-card";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { summarizeClientGoals, type ClientGoalsSummary } from "@/lib/client-goals-summary";
import type { DistributorClientProfile } from "@/lib/distributor-types";
import { formatAum } from "@/lib/format";

const RING_TRACK = "color-mix(in srgb, var(--border) 65%, var(--card))";
const RING_FILL = "var(--primary)";

type ClientGoalsTabPanelProps = {
  profile: DistributorClientProfile;
};

function ClientGoalsGraphCard({ summary }: { summary: ClientGoalsSummary }) {
  const copy = DISTRIBUTOR_CLIENT_COPY.goals;
  const chartData = useMemo(
    () => [{ name: "progress", value: summary.progressPct }],
    [summary.progressPct],
  );

  return (
    <article className="distributor-client-goals-graph-card">
      <div className="distributor-client-goals-graph-card__head">
        <DistributorInsightCardHeader
          eyebrow={copy.totalGoalsLabel}
          title={copy.overallProgressLabel}
          titleAs="p"
        />
      </div>

      <div
        className="distributor-client-goals-graph-card__canvas"
        role="img"
        aria-label={`${summary.progressPct}% overall goal progress`}
      >
        <div className="distributor-client-goals-graph-card__canvas-inner">
          <div className="distributor-client-goals-graph-card__ring">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="72%"
                outerRadius="100%"
                barSize={16}
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: RING_TRACK }}
                  dataKey="value"
                  cornerRadius={999}
                  fill={RING_FILL}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="distributor-client-goals-graph-card__ring-center">
              <p className="distributor-client-goals-graph-card__ring-pct tabular-nums">{summary.progressPct}%</p>
            </div>
          </div>
          <div className="distributor-client-goals-graph-card__metrics">
            <div className="distributor-client-goals-graph-card__metric">
              <p className="distributor-insight-card-metric__eyebrow">{copy.totalGoalAmountLabel}</p>
              <p className="distributor-insight-card-metric__title tabular-nums">
                {formatAum(summary.totalTargetAmount)}
              </p>
            </div>
            <div className="distributor-client-goals-graph-card__metric">
              <p className="distributor-insight-card-metric__eyebrow">{copy.amountInvestedLabel}</p>
              <p className="distributor-insight-card-metric__title tabular-nums">
                {formatAum(summary.totalInvestedAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ClientGoalsTabPanel({ profile }: ClientGoalsTabPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.goals;
  const goals = useMemo(() => profile.goals ?? [], [profile.goals]);

  if (goals.length === 0) {
    return <ClientDetailEmptyState message={copy.empty} icon={Goal} />;
  }

  const summary = summarizeClientGoals(goals);

  return (
    <div className="flex flex-col gap-4">
      <div className="distributor-client-goals-top-row">
        <div className="distributor-client-goals-top-row__stats">
          <DistributorMetricCard
            variant="tile"
            tileTone="accent"
            icon={Target}
            label={copy.totalGoalsLabel}
            value={String(summary.totalGoals)}
            hint={`${formatAum(summary.totalTargetAmount)} ${copy.target.toLowerCase()}`}
            showTileAction={false}
          />
          <DistributorMetricCard
            variant="tile"
            icon={Target}
            label={copy.activeGoalsLabel}
            value={String(summary.activeGoals)}
            hint={`${copy.investedLabel} ${formatAum(summary.activeInvestedAmount)}`}
            showTileAction={false}
            className="distributor-client-goals-stat-card--active"
          />
        </div>
        <ClientGoalsGraphCard summary={summary} />
      </div>

      <ClientGoalsListCard goals={goals} />
    </div>
  );
}
