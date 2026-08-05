"use client";

import type { ReactNode } from "react";

import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { SecurityLoginAlerts } from "@/features/account/security/security-login-alerts";
import { OverviewFamilyCircles } from "@/features/dashboard/overview/components/overview-family-circles";
import { OverviewGoalsCard } from "@/features/dashboard/overview/components/overview-goals-card";
import { OverviewPageSkeleton } from "@/features/dashboard/overview/components/overview-page-skeleton";
import { OverviewHoldingsCard } from "@/features/dashboard/overview/components/overview-holdings-card";
import { OverviewPortfolioFlowCard } from "@/features/dashboard/overview/components/overview-portfolio-flow-card";
import { OverviewProfileCard } from "@/features/dashboard/overview/components/overview-profile-card";
import { OverviewRecentTransactions } from "@/features/dashboard/overview/components/overview-recent-transactions";
import { OverviewRiskCard } from "@/features/dashboard/overview/components/overview-risk-card";
import { OverviewSipsCard } from "@/features/dashboard/overview/components/overview-sips-card";
import { OverviewWelcomeHeader } from "@/features/dashboard/overview/components/overview-welcome-header";
import { useOverviewDashboardData } from "@/features/dashboard/overview/hooks/use-overview-dashboard-data";
import { useAuth } from "@/contexts/auth-context";

function OverviewContentFade({ children }: { children: ReactNode }) {
  return <div className="animate-in fade-in duration-300 ease-out">{children}</div>;
}

export function PortfolioOverviewPage() {
  const { user } = useAuth();
  const { ready } = useOverviewDashboardData();

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-w-0 pb-8">
      <SecurityLoginAlerts />
      <FundEligibilityBanner />

      {!ready ? (
        <OverviewPageSkeleton />
      ) : (
        <OverviewContentFade>
          <OverviewWelcomeHeader name={user.first_name ?? "there"} />
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
            <OverviewProfileCard className="shrink-0" />
            <OverviewPortfolioFlowCard className="min-w-0 flex-1 lg:min-w-[27rem]" />
            <OverviewHoldingsCard className="min-w-0 lg:w-[17rem] lg:shrink-0 xl:w-[18rem]" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1.15fr)] xl:items-stretch">
            <div className="grid grid-cols-[minmax(9rem,10.5rem)_minmax(0,1fr)] gap-3 sm:gap-4">
              <OverviewRiskCard />
              <OverviewSipsCard />
            </div>

            <OverviewGoalsCard className="min-w-0" />

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-stretch xl:col-span-2">
              <OverviewFamilyCircles />
              <OverviewRecentTransactions className="min-w-0" />
            </div>
          </div>
        </OverviewContentFade>
      )}
    </div>
  );
}
