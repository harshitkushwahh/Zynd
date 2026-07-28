"use client";

import { Briefcase, UserCheck, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import { InvestorsPanel } from "@/components/investors/investors-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import {
  DUMMY_INVESTORS,
  filterSystemResidentInvestors,
} from "@/lib/dummy/investors";

export function SystemResidentialInvestorsPage() {
  const scoped = filterSystemResidentInvestors(DUMMY_INVESTORS);
  const pmCount = scoped.filter((i) => i.serviceModel === "pm").length;
  const diyCount = scoped.filter((i) => i.serviceModel === "diy").length;
  const onboardedCount = scoped.filter((i) => i.onboardingStatus === "Onboarded").length;
  const investedCount = scoped.filter((i) => i.investmentStatus === "Invested").length;

  const pageConfig = DISTRIBUTOR_PAGE_CONFIG.residentInvestors;
  const PageIcon = resolveDistributorPageIcon(pageConfig.iconName);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader icon={PageIcon} title={pageConfig.title} description={pageConfig.description} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={Users}
          label="All residents"
          value={String(scoped.length)}
          hint="Platform-wide (demo)"
        />
        <DistributorMetricCard icon={Briefcase} label="PM clients" value={String(pmCount)} hint="Portfolio managed" />
        <DistributorMetricCard icon={Users} label="DIY clients" value={String(diyCount)} hint="Self-directed" />
        <DistributorMetricCard
          icon={UserCheck}
          label="Invested"
          value={String(investedCount)}
          hint={`${onboardedCount} onboarded`}
        />
      </div>

      <InvestorsPanel
        {...pageConfig}
        investorScope="system-residents"
        listOrigin="system-resident"
        showServiceModel
        layout="table"
      />
    </div>
  );
}
