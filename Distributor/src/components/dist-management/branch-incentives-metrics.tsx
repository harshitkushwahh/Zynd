"use client";

import { useMemo } from "react";
import { HandCoins, IndianRupee, Lock, Wallet } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  getBranchCommissionTotals,
  type BranchCommissionPeriod,
} from "@/lib/dummy/branch-commissions";
import {
  DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

type BranchIncentivesMetricsProps = {
  period?: BranchCommissionPeriod;
  className?: string;
};

export function BranchIncentivesMetrics({
  period = "mtd",
  className,
}: BranchIncentivesMetricsProps) {
  const totals = useMemo(() => getBranchCommissionTotals(period), [period]);

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
        icon={HandCoins}
        label="Accrued"
        value={formatAum(totals.accrued)}
        hint={period === "mtd" ? "Month to date" : "Last calendar month"}
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Wallet}
        label="Released"
        value={formatAum(totals.released)}
        hint="Eligible after settlement"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Lock}
        label="On hold"
        value={formatAum(totals.onHold)}
        hint="Pending txn or compliance"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={IndianRupee}
        label="Net payable"
        value={formatAum(totals.netPayable)}
        hint="Scheduled for payout run"
        showTileAction={false}
        fitTileValue
      />
    </div>
  );
}
