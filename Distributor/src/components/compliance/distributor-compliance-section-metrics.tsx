"use client";

import { useMemo } from "react";
import { AlertTriangle, ClipboardCheck, PenLine, ShieldAlert } from "lucide-react";

import { DistributorComplianceResolutionCard } from "@/components/compliance/distributor-compliance-resolution-card";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  getDistributorComplianceSummary,
  type DistributorComplianceQueueRow,
} from "@/lib/distributor-compliance-data";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
} from "@/lib/distributor-layout";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type DistributorComplianceSectionMetricsProps = {
  rows: DistributorComplianceQueueRow[];
  className?: string;
};

export function DistributorComplianceSectionMetrics({
  rows,
  className,
}: DistributorComplianceSectionMetricsProps) {
  const summary = useMemo(() => getDistributorComplianceSummary(rows), [rows]);

  return (
    <div
      className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS, "distributor-compliance-metrics", className)}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={ClipboardCheck}
        label="Open items"
        value={String(summary.total)}
        hint={ZYND_MITRA_COPY.needsMitraAction}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={ShieldAlert}
        label="KYC pending"
        value={String(summary.kycPending)}
        hint="Incomplete onboarding"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={PenLine}
        label="eSign pending"
        value={String(summary.eSignPending)}
        hint="Awaiting client signature"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={AlertTriangle}
        label="High priority"
        value={String(summary.highPriority)}
        hint="Resolve within 48h"
        showTileAction={false}
      />
      <DistributorComplianceResolutionCard
        rows={rows}
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__resolution min-w-0 shrink-0"
      />
    </div>
  );
}
