"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock3, Mail, UserPlus, UserX } from "lucide-react";

import { DistributorLeadsConversionCard } from "@/components/leads/distributor-leads-conversion-card";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  getDistributorLeadSummary,
  type DistributorLeadRow,
} from "@/lib/dummy/distributor-leads";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorLeadsSectionMetricsProps = {
  rows: DistributorLeadRow[];
  className?: string;
};

export function DistributorLeadsSectionMetrics({
  rows,
  className,
}: DistributorLeadsSectionMetricsProps) {
  const summary = useMemo(() => getDistributorLeadSummary(rows), [rows]);

  return (
    <div className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS, "distributor-leads-metrics", className)}>
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={Mail}
        label="Invited"
        value={String(summary.invited)}
        hint="Awaiting signup"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Clock3}
        label="KYC started"
        value={String(summary.kycStarted)}
        hint="In onboarding flow"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={UserX}
        label="Dropped off"
        value={String(summary.kycDropped)}
        hint="Needs follow-up"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={UserPlus}
        label="Ready to invest"
        value={String(summary.readyToInvest)}
        hint="KYC complete"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={CheckCircle2}
        label="First investment"
        value={String(summary.firstInvestment)}
        hint="Activated clients"
        showTileAction={false}
      />
      <DistributorLeadsConversionCard
        rows={rows}
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__ratio min-w-0 shrink-0"
      />
    </div>
  );
}
