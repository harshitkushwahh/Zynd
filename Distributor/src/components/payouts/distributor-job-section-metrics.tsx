"use client";

import { useMemo } from "react";
import { Banknote, Gift, HandCoins, Wallet } from "lucide-react";

import { DistributorCompensationSplitCard } from "@/components/payouts/distributor-compensation-split-card";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  getDistributorJobCompensationSummary,
} from "@/lib/dummy/distributor-job-dashboard";
import { getDistributorPayoutSummary, DUMMY_DISTRIBUTOR_PAYOUTS } from "@/lib/dummy/distributor-payouts";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
} from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate, formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type DistributorJobSectionMetricsProps = {
  className?: string;
};

function formatTileAmount(amount: number): { display: string; title: string } {
  return {
    display: formatPortfolioMetricAmount(amount),
    title: formatAum(amount),
  };
}

export function DistributorJobSectionMetrics({ className }: DistributorJobSectionMetricsProps) {
  const compensation = DUMMY_DISTRIBUTOR_JOB_COMPENSATION;
  const summary = useMemo(() => getDistributorJobCompensationSummary(compensation), [compensation]);
  const payoutSummary = useMemo(
    () => getDistributorPayoutSummary(DUMMY_DISTRIBUTOR_PAYOUTS),
    [],
  );

  const takeHome = formatTileAmount(summary.takeHome);
  const baseSalary = formatTileAmount(summary.basicSalary);
  const variablePay = formatTileAmount(summary.variablePay);
  const commissionDue = formatTileAmount(payoutSummary.nextPayoutAmount);

  return (
    <div className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS, "distributor-job-metrics", className)}>
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={Wallet}
        label="Take-home"
        value={takeHome.display}
        valueTitle={takeHome.title}
        hint={`${compensation.periodLabel} · Salary + incentives`}
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Banknote}
        label="Base salary"
        value={baseSalary.display}
        valueTitle={baseSalary.title}
        hint="Fixed monthly pay"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Gift}
        label="Variable pay"
        value={variablePay.display}
        valueTitle={variablePay.title}
        hint="Performance + spot bonus"
        showTileAction={false}
        fitTileValue
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={HandCoins}
        label="Commission due"
        value={commissionDue.display}
        valueTitle={commissionDue.title}
        hint={
          payoutSummary.nextPayoutDate
            ? `Settles ${formatDistributorDate(payoutSummary.nextPayoutDate)}`
            : "No settlement scheduled"
        }
        showTileAction={false}
        fitTileValue
      />
      <DistributorCompensationSplitCard
        compensation={compensation}
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__split min-w-0 shrink-0"
      />
    </div>
  );
}
