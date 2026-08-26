"use client";

import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorClientsBookSummaryCard } from "@/components/workspace/your-clients-book-summary-card";
import { DistributorClientsInvestmentRatioCard } from "@/components/workspace/your-clients-investment-ratio-card";
import {
  getDistributorClientsListScopeLeadTile,
  type DistributorClientsListScope,
} from "@/lib/distributor-clients-list-scope";
import {
  DUMMY_INVESTORS,
  filterDistributorBookInvestors,
} from "@/lib/distributor-investor-utils";
import { cn } from "@/lib/utils";

const tileClass =
  "distributor-your-clients-metrics__cell distributor-your-clients-metrics__tile min-w-0 shrink-0";

type YourClientsBookMetricsProps = {
  listScope?: DistributorClientsListScope;
  className?: string;
};

export function YourClientsBookMetrics({
  listScope = "your-book",
  className,
}: YourClientsBookMetricsProps) {
  const scoped = filterDistributorBookInvestors(DUMMY_INVESTORS);
  const leadTile = getDistributorClientsListScopeLeadTile(listScope, DUMMY_INVESTORS);
  const onboardedCount = scoped.filter((i) => i.onboardingStatus === "Onboarded").length;
  const pendingOnboardingCount = scoped.length - onboardedCount;
  const investedCount = scoped.filter((i) => i.investmentStatus === "Invested").length;
  const notInvestedCount = scoped.length - investedCount;
  const compliantCount = scoped.filter((i) => i.complianceStatus === "Compliant").length;
  const nonCompliantCount = scoped.length - compliantCount;

  return (
    <div className={cn("distributor-your-clients-metrics", className)}>
      <DistributorMetricCard
        className={tileClass}
        variant="tile"
        tileTone="accent"
        icon={Users}
        label={leadTile.label}
        value={String(leadTile.value)}
        hint={leadTile.hint}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={tileClass}
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
        className={tileClass}
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
        className={tileClass}
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
