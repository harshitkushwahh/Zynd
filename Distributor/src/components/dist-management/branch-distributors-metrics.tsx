"use client";

import { IndianRupee, UserCheck, Users2, UsersRound } from "lucide-react";
import { useMemo } from "react";

import { BranchDistributorsStatusSummaryCard } from "@/components/dist-management/branch-distributors-status-summary-card";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  DUMMY_BRANCH_DISTRIBUTORS,
  type BranchDistributorRecord,
} from "@/lib/dummy/branch-distributors";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const tileClass =
  "distributor-your-clients-metrics__cell distributor-your-clients-metrics__tile min-w-0 shrink-0";

type BranchDistributorsMetricsProps = {
  rows?: BranchDistributorRecord[];
  className?: string;
};

export function BranchDistributorsMetrics({
  rows = DUMMY_BRANCH_DISTRIBUTORS,
  className,
}: BranchDistributorsMetricsProps) {
  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.status === "Active").length;
    const former = rows.filter((row) => row.status === "Former").length;
    const paused = rows.filter((row) => row.status === "Paused").length;
    const totalAum = rows.reduce((sum, row) => sum + row.aum, 0);
    const totalClients = rows.reduce((sum, row) => sum + row.clientCount, 0);
    const activeClients = rows
      .filter((row) => row.status === "Active")
      .reduce((sum, row) => sum + row.clientCount, 0);

    return { total, active, former, paused, totalAum, totalClients, activeClients };
  }, [rows]);

  return (
    <div className={cn("distributor-your-clients-metrics distributor-branch-distributors-metrics", className)}>
      <DistributorMetricCard
        className={tileClass}
        variant="tile"
        tileTone="accent"
        icon={Users2}
        label={ZYND_MITRA_COPY.plural}
        value={String(stats.total)}
        hint="In this branch"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={tileClass}
        variant="tile"
        icon={UserCheck}
        label="Active"
        value={String(stats.active)}
        hint={
          stats.paused === 1
            ? "1 paused on book"
            : `${stats.paused} paused on book`
        }
        showTileAction={false}
      />
      <DistributorMetricCard
        className={tileClass}
        variant="tile"
        icon={UsersRound}
        label="Clients"
        value={String(stats.totalClients)}
        hint={`${stats.activeClients} on active books`}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={cn(
          tileClass,
          "distributor-branch-distributors-metrics__aum-tile",
        )}
        variant="tile"
        icon={IndianRupee}
        label="Branch AUM"
        value={formatAum(stats.totalAum)}
        hint="Demo aggregate"
        showTileAction={false}
      />
      <BranchDistributorsStatusSummaryCard
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__summary min-w-0 shrink-0"
        stats={{
          total: stats.total,
          active: stats.active,
          former: stats.former,
          paused: stats.paused,
        }}
      />
    </div>
  );
}
