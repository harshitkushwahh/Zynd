"use client";

import { useMemo } from "react";
import { FileSpreadsheet, IndianRupee, TrendingUp, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { getDistributorReportSummary } from "@/lib/distributor-reports-data";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
} from "@/lib/distributor-layout";
import { formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export function DistributorReportsSectionMetrics({ className }: { className?: string }) {
  const summary = useMemo(() => getDistributorReportSummary(), []);

  return (
    <div
      className={cn(
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
        "distributor-your-clients-metrics--tiles-only distributor-reports-metrics",
        className,
      )}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={TrendingUp}
        label="Book AUM"
        value={formatPortfolioMetricAmount(summary.bookAum)}
        hint={ZYND_MITRA_COPY.yourBook}
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Users}
        label="Clients"
        value={String(summary.clientCount)}
        hint={
          summary.onboardingClients === 1
            ? `${summary.activeClients} active · 1 onboarding`
            : `${summary.activeClients} active · ${summary.onboardingClients} onboarding`
        }
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={FileSpreadsheet}
        label="Report templates"
        value={String(summary.templates)}
        hint={`${summary.bookTemplates} book · ${summary.incentiveTemplates} incentive`}
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={IndianRupee}
        label="Incentives"
        value={formatPortfolioMetricAmount(summary.incomeMtd)}
        hint="Incentive earned MTD"
        showTileAction={false}
        fitTileValue
      />
    </div>
  );
}
