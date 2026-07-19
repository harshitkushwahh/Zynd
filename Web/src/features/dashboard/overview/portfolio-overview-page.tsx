"use client";

import { LayoutDashboard } from "lucide-react";

import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { SecurityLoginAlerts } from "@/features/account/security/security-login-alerts";
import { OverviewQuickLinks } from "@/features/dashboard/overview/components/overview-quick-links";
import { OverviewRecentTransactions } from "@/features/dashboard/overview/components/overview-recent-transactions";
import { PageTitle } from "@/components/ui/page-title";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

export function PortfolioOverviewPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-w-0">
      <SecurityLoginAlerts />
      <FundEligibilityBanner />

      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
          <LayoutDashboard className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <PageTitle>Welcome, {user.first_name ?? "there"}</PageTitle>
          <p className="mt-2 text-compact text-muted-foreground">
            {copy.dashboard.overview.welcomeSubtitle}
          </p>
        </div>
      </div>

      <OverviewQuickLinks />

      <OverviewRecentTransactions />
    </div>
  );
}
