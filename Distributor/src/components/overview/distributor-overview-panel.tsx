"use client";

import { CalendarClock, FolderKanban, Layers3, ArrowLeftRight } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorCodeCopyBadge } from "@/components/dashboard/distributor-code-copy-badge";
import { DistributorBookInsightsCard } from "@/components/overview/distributor-book-insights-card";
import { DistributorSalariesIncentiveColumn } from "@/components/overview/distributor-salaries-incentive-column";
import { DistributorDashboardSkeleton } from "@/components/overview/distributor-dashboard-skeleton";
import { useDashboardPageReveal } from "@/components/overview/use-dashboard-page-reveal";
import { DistributorDashboardGreeting } from "@/components/ui/distributor-dashboard-greeting";
import { DistributorProfileHeroCard } from "@/components/ui/distributor-profile-hero-card";
import { DistributorOperationsWorkTimeCard } from "@/components/overview/distributor-operations-work-time-card";
import { DistributorOperationsTeamTrackCard } from "@/components/overview/distributor-operations-team-track-card";
import { DistributorOverviewSection } from "@/components/overview/distributor-overview-section";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { getDistributorNavGroup } from "@/lib/distributor-navigation";
import { getDistributorProfile } from "@/lib/distributor-profile";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

const pendingOrders = DUMMY_ORDERS.filter((o) => o.status === "Pending" || o.status === "Processing").length;
const activePlans = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.status === "Active").length;

export function DistributorOverviewPanel() {
  const { displayName, user, loading: authLoading } = useDistributorAuth();
  const { showSkeleton } = useDashboardPageReveal({ ready: !authLoading });
  const { requests: txnRequests } = useDistributorTxnRequests();
  const roleLabel = user?.role
    ? user.role.replaceAll("_", " ")
    : ZYND_MITRA_COPY.defaultRoleLabel;
  const pendingTxnRequests = txnRequests.filter((r) => r.status === "Pending").length;
  const operationsGroup = getDistributorNavGroup("operations");
  const openTransactionGroups = DUMMY_TRANSACTION_GROUPS.filter(
    (group) => group.status === "Draft" || group.status === "Submitted",
  ).length;
  const distributorProfile = getDistributorProfile(user?.id);
  const distributorCode = distributorProfile.distributorCode.trim();

  if (showSkeleton) {
    return <DistributorDashboardSkeleton />;
  }

  return (
    <div
      className={cn(
        "distributor-dashboard-page distributor-dashboard-page--enter distributor-your-clients-scope-panel__layer",
      )}
    >
      <DistributorDashboardGreeting
        name={displayName}
        className="distributor-dashboard-page__greeting"
      />

      <div className="distributor-dashboard-page__payout">
        <DistributorSalariesIncentiveColumn />
      </div>

      <div className="distributor-dashboard-page__body">
        <div className="distributor-dashboard-top">
          <div className="distributor-dashboard-top__profile">
            <DistributorProfileHeroCard
              name={displayName}
              roleLabel={roleLabel}
              imageSrc={user?.avatarUrl}
              email={user?.email}
              phone={distributorProfile.mobile}
              badge={
                distributorCode ? (
                  <DistributorCodeCopyBadge distributorCode={distributorCode} />
                ) : undefined
              }
            />
          </div>
          <div className="distributor-dashboard-top__insights">
            <DistributorBookInsightsCard />
          </div>
        </div>

        {operationsGroup ? (
          <DistributorOverviewSection className="distributor-dashboard-operations">
            <div className="distributor-dashboard-operations-row">
              <div className="distributor-dashboard-operations__grid">
              <DistributorMetricCard
                variant="tile"
                tileTone="accent"
                icon={Layers3}
                label="Open orders"
                value={String(pendingOrders)}
                hint={`${DUMMY_ORDERS.length} total in demo`}
                href="/dashboard/your-operations"
              />
              <DistributorMetricCard
                variant="tile"
                icon={CalendarClock}
                label="Active SIPs"
                value={String(activePlans)}
                hint="Systematic plans"
                href="/dashboard/your-operations"
              />
              <DistributorMetricCard
                variant="tile"
                icon={ArrowLeftRight}
                label="Pending approvals"
                value={String(pendingTxnRequests)}
                hint="Txn requests awaiting action"
                href="/dashboard/your-operations"
              />
              <DistributorMetricCard
                variant="tile"
                tileTone="accent"
                icon={FolderKanban}
                label="Transaction groups"
                value={String(DUMMY_TRANSACTION_GROUPS.length)}
                hint={
                  openTransactionGroups === 1
                    ? "1 draft or submitted"
                    : `${openTransactionGroups} draft or submitted`
                }
                href="/dashboard/your-operations"
              />
              </div>
              <div className="distributor-dashboard-operations-insights">
                <DistributorOperationsWorkTimeCard />
                <DistributorOperationsTeamTrackCard />
              </div>
            </div>
          </DistributorOverviewSection>
        ) : null}
      </div>
    </div>
  );
}
