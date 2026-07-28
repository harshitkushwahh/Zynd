"use client";

import type { ReactNode } from "react";

import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { SecurityLoginAlerts } from "@/features/account/security/security-login-alerts";
import { OverviewFamilyCircles } from "@/features/dashboard/overview/components/overview-family-circles";
import { OverviewGoalsCard } from "@/features/dashboard/overview/components/overview-goals-card";
import { OverviewPageSkeleton } from "@/features/dashboard/overview/components/overview-page-skeleton";
import { OverviewPortfolioCard } from "@/features/dashboard/overview/components/overview-portfolio-card";
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1.15fr)] xl:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-[minmax(9rem,10.5rem)_minmax(0,1fr)] gap-3 sm:gap-4">
                <OverviewRiskCard />
                <OverviewFamilyCircles />
              </div>

              <OverviewSipsCard />
              <OverviewRecentTransactions />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <OverviewPortfolioCard />
              <OverviewGoalsCard />
            </div>
          </div>
        </OverviewContentFade>
      )}
    </div>
  );
}
