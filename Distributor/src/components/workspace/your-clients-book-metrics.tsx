"use client";

import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  DUMMY_INVESTORS,
  filterDistributorBookInvestors,
} from "@/lib/dummy/investors";

export function YourClientsBookMetrics() {
  const scoped = filterDistributorBookInvestors(DUMMY_INVESTORS);
  const onboardedCount = scoped.filter((i) => i.onboardingStatus === "Onboarded").length;
  const pendingOnboardingCount = scoped.length - onboardedCount;
  const investedCount = scoped.filter((i) => i.investmentStatus === "Invested").length;
  const compliantCount = scoped.filter((i) => i.complianceStatus === "Compliant").length;
  const nonCompliantCount = scoped.length - compliantCount;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DistributorMetricCard
        icon={Users}
        label="Your clients"
        value={String(scoped.length)}
        hint="Added by you"
      />
      <DistributorMetricCard
        icon={UserPlus}
        label="Onboarded"
        value={String(onboardedCount)}
        hint={
          pendingOnboardingCount === 1
            ? "1 pending onboarding"
            : `${pendingOnboardingCount} pending onboarding`
        }
      />
      <DistributorMetricCard
        icon={UserCheck}
        label="Invested"
        value={String(investedCount)}
        hint={
          scoped.length - investedCount === 1
            ? "1 not invested yet"
            : `${scoped.length - investedCount} not invested yet`
        }
      />
      <DistributorMetricCard
        icon={ShieldCheck}
        label="Compliant"
        value={String(compliantCount)}
        hint={nonCompliantCount === 1 ? "1 needs attention" : `${nonCompliantCount} need attention`}
      />
    </div>
  );
}
