"use client";

import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { SecurityLoginAlerts } from "@/features/account/security/security-login-alerts";
import { overviewContent } from "@/features/dashboard/config/dashboard-content";
import { OverviewPortfolioSection } from "@/features/dashboard/overview/components/overview-portfolio-section";
import { OverviewProfileCard } from "@/features/dashboard/overview/components/overview-profile-card";
import { OverviewRecentActivity } from "@/features/dashboard/overview/components/overview-recent-activity";
import { OverviewStatCards } from "@/features/dashboard/overview/components/overview-stat-cards";
import { useAuth } from "@/contexts/auth-context";

export function PortfolioOverviewPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-w-0">
      <SecurityLoginAlerts />
      <FundEligibilityBanner />

      <div className="mb-8">
        <h1 className="text-h2 font-bold text-foreground">
          Welcome, {user.first_name ?? "there"}
        </h1>
        <p className="mt-2 text-compact text-muted-foreground">
          {overviewContent.welcomeSubtitle}
        </p>
      </div>

      <OverviewStatCards />

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewPortfolioSection />
        <OverviewProfileCard />
        <OverviewRecentActivity />
      </div>
    </div>
  );
}
