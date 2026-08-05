"use client";

import { useMemo } from "react";
import { Target, TrendingUp, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  DUMMY_BRANCH_INVESTOR_FUNNEL,
  DUMMY_BRANCH_TARGET_HEATMAP,
  DUMMY_DISTRIBUTOR_TXN_MIX,
} from "@/lib/dummy/branch-team-performance";
import {
  DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

type BranchTeamPerformanceMetricsProps = {
  className?: string;
};

export function BranchTeamPerformanceMetrics({ className }: BranchTeamPerformanceMetricsProps) {
  const { branchAttainmentMtd, branchSipShare, branchSipTotal, branchLumpsumTotal, kycToTxnPct, firstTxn, kycDone, activeSipCount } =
    useMemo(() => {
      const branchSipTotal = DUMMY_DISTRIBUTOR_TXN_MIX.reduce((s, r) => s + r.sipAmount, 0);
      const branchLumpsumTotal = DUMMY_DISTRIBUTOR_TXN_MIX.reduce((s, r) => s + r.lumpsumAmount, 0);
      const branchTotal = branchSipTotal + branchLumpsumTotal;
      const branchSipShare = branchTotal > 0 ? Math.round((branchSipTotal / branchTotal) * 100) : 0;

      const kycDone = DUMMY_BRANCH_INVESTOR_FUNNEL.find((s) => s.id === "kyc-done")?.count ?? 0;
      const firstTxn = DUMMY_BRANCH_INVESTOR_FUNNEL.find((s) => s.id === "first-txn")?.count ?? 0;
      const kycToTxnPct = kycDone > 0 ? Math.round((firstTxn / kycDone) * 100) : 0;

      const juneCells = DUMMY_BRANCH_TARGET_HEATMAP.filter((c) => c.month === "Jun" && c.year === 2026);
      const branchAttainmentMtd =
        juneCells.length > 0
          ? Math.round(juneCells.reduce((s, c) => s + c.attainmentPct, 0) / juneCells.length)
          : 0;

      const activeSipCount = DUMMY_BRANCH_INVESTOR_FUNNEL.find((s) => s.id === "active-sip")?.count ?? 0;

      return {
        branchAttainmentMtd,
        branchSipShare,
        branchSipTotal,
        branchLumpsumTotal,
        kycToTxnPct,
        firstTxn,
        kycDone,
        activeSipCount,
      };
    }, []);

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
        icon={Target}
        label="Target attainment (Jun)"
        value={`${branchAttainmentMtd}%`}
        hint="Branch average vs monthly goal"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={TrendingUp}
        label="SIP share"
        value={`${branchSipShare}%`}
        hint={`${formatAum(branchSipTotal)} SIP · ${formatAum(branchLumpsumTotal)} lumpsum`}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Users}
        label="Active SIP investors"
        value={String(activeSipCount)}
        hint="End of acquisition funnel"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Users}
        label="KYC → first txn"
        value={`${kycToTxnPct}%`}
        hint={`${firstTxn} of ${kycDone} KYC-complete converted`}
        showTileAction={false}
      />
    </div>
  );
}
