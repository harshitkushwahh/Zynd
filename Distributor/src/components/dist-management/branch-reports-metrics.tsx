"use client";

import { useMemo } from "react";
import { AlertTriangle, LineChart, TrendingUp, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { getBranchReportSummary } from "@/lib/dummy/branch-reports";
import {
  DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

type BranchReportsMetricsProps = {
  className?: string;
};

export function BranchReportsMetrics({ className }: BranchReportsMetricsProps) {
  const summary = useMemo(() => getBranchReportSummary(), []);

  return (
    <div
      className={cn(
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
        DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
        className,
      )}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={LineChart}
        label="Branch AUM"
        value={formatAum(summary.branchAum)}
        hint="As of last business day"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={TrendingUp}
        label="Net sales (MTD)"
        value={formatAum(summary.netSalesMtd)}
        hint="Inflow minus redemptions"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Users}
        label="KYC pending"
        value={String(summary.kycPending)}
        hint="Open onboarding cases"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={AlertTriangle}
        label="Compliance exceptions"
        value={String(summary.complianceOpen)}
        hint="Open or in review"
        showTileAction={false}
      />
    </div>
  );
}
