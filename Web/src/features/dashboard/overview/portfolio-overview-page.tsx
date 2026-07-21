"use client";

import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { SecurityLoginAlerts } from "@/features/account/security/security-login-alerts";
import { OverviewRecentTransactions } from "@/features/dashboard/overview/components/overview-recent-transactions";
import { OverviewWelcomeHeader } from "@/features/dashboard/overview/components/overview-welcome-header";
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

      <OverviewWelcomeHeader name={user.first_name ?? "there"} />

      <OverviewRecentTransactions />
    </div>
  );
}
