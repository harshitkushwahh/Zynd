"use client";

import { useMemo } from "react";
import { Target, UsersRound, Wallet } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorClientFamilyGroup } from "@/lib/dummy/types";
import { formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClientFamilyTabStatusMetricsProps = {
  groups: DistributorClientFamilyGroup[];
  className?: string;
};

function aggregateFamilyTabStatus(groups: DistributorClientFamilyGroup[]) {
  return groups.reduce(
    (acc, group) => ({
      memberCount: acc.memberCount + group.memberCount,
      activeGoals: acc.activeGoals + group.activeGoals,
      totalValue: acc.totalValue + group.totalValue,
    }),
    { memberCount: 0, activeGoals: 0, totalValue: 0 },
  );
}

export function ClientFamilyTabStatusMetrics({ groups, className }: ClientFamilyTabStatusMetricsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const totals = useMemo(() => aggregateFamilyTabStatus(groups), [groups]);

  return (
    <div
      className={cn(
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
        DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
        "distributor-client-family-tab__status-metrics",
        className,
      )}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={UsersRound}
        label={copy.membersTileLabel}
        value={String(totals.memberCount)}
        hint={copy.membersTileHint}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Target}
        label={copy.goalsTileLabel}
        value={String(totals.activeGoals)}
        hint={copy.goalsTileHint}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Wallet}
        label={copy.summaryTotalValueLabel}
        value={formatPortfolioMetricAmount(totals.totalValue)}
        hint={copy.summaryTotalValueHint}
        showTileAction={false}
      />
    </div>
  );
}
