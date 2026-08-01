"use client";

import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorClientsBookSummaryCard } from "@/components/workspace/your-clients-book-summary-card";
import { DistributorClientsInvestmentRatioCard } from "@/components/workspace/your-clients-investment-ratio-card";
import { DUMMY_INVESTORS, filterInvestorsByType } from "@/lib/dummy/investors";
import type { InvestorType } from "@/lib/dummy/types";
import { DISTRIBUTOR_METRIC_TILE_CELL_CLASS } from "@/lib/distributor-layout";

type YourClientsSectionMetricsProps = {
  investorType: InvestorType;
};

export function YourClientsSectionMetrics({ investorType }: YourClientsSectionMetricsProps) {
  const scoped = filterInvestorsByType(DUMMY_INVESTORS, investorType);
  const onboardedCount = scoped.filter((i) => i.onboardingStatus === "Onboarded").length;
  const pendingOnboardingCount = scoped.length - onboardedCount;
  const investedCount = scoped.filter((i) => i.investmentStatus === "Invested").length;
  const notInvestedCount = scoped.length - investedCount;
  const compliantCount = scoped.filter((i) => i.complianceStatus === "Compliant").length;
  const nonCompliantCount = scoped.length - compliantCount;

  return (
    <div className="distributor-your-clients-metrics">
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={Users}
        label="Your clients"
        value={String(scoped.length)}
        hint="Added by you"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={UserPlus}
        label="Onboarded"
        value={String(onboardedCount)}
        hint={
          pendingOnboardingCount === 1
            ? "1 pending onboarding"
            : `${pendingOnboardingCount} pending onboarding`
        }
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={UserCheck}
        label="Invested"
        value={String(investedCount)}
        hint={
          notInvestedCount === 1 ? "1 not invested yet" : `${notInvestedCount} not invested yet`
        }
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={ShieldCheck}
        label="Compliant"
        value={String(compliantCount)}
        hint={nonCompliantCount === 1 ? "1 needs attention" : `${nonCompliantCount} need attention`}
        showTileAction={false}
      />
      <DistributorClientsInvestmentRatioCard
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__ratio min-w-0 shrink-0"
        stats={{
          total: scoped.length,
          invested: investedCount,
          trendVsLastWeek: 2.1,
        }}
      />
      <DistributorClientsBookSummaryCard
        className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__summary min-w-0 shrink-0"
        variant="square"
        stats={{
          total: scoped.length,
          onboarded: onboardedCount,
          compliant: compliantCount,
          invested: investedCount,
        }}
      />
    </div>
  );
}
