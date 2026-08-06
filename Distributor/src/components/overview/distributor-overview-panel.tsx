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
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { getDistributorNavGroup } from "@/lib/distributor-navigation";
import { getDistributorProfile } from "@/lib/distributor-profile";
import { getDistributorExperienceLabel } from "@/lib/distributor-profile-hero";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

export function DistributorOverviewPanel() {
  const { displayName, user, loading: authLoading } = useDistributorAuth();
  const { showSkeleton } = useDashboardPageReveal({ ready: !authLoading });
  const { requests: txnRequests } = useDistributorTxnRequests();
  const roleLabel = user?.role
    ? user.role.replaceAll("_", " ")
    : ZYND_MITRA_COPY.defaultRoleLabel;
  const pendingTxnRequests = txnRequests.filter((r) => r.status === "Pending").length;
  const operationsGroup = getDistributorNavGroup("operations");
  const distributorProfile = getDistributorProfile(user?.id);
  const distributorCode = distributorProfile.distributorCode.trim();
  const experienceLabel = user?.joinedAt
    ? getDistributorExperienceLabel(user.joinedAt)
    : undefined;

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
              experienceLabel={experienceLabel}
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
                {operationsGroup.items.map((item) => {
                  const Icon = item.icon;
                  const tileTone =
                    item.id === "orders" || item.id === "transaction-groups" ? "accent" : "default";

                  if (item.id === "orders") {
                    return (
                      <DistributorMetricCard
                        key={item.id}
                        variant="tile"
                        tileTone={tileTone}
                        href={item.href}
                        icon={Icon}
                        label={item.label}
                        value="0"
                        hint="No pending orders"
                      />
                    );
                  }
                  if (item.id === "systematic-plans") {
                    return (
                      <DistributorMetricCard
                        key={item.id}
                        variant="tile"
                        tileTone={tileTone}
                        href={item.href}
                        icon={CalendarClock}
                        label={item.label}
                        value="0"
                        hint="No active plans"
                      />
                    );
                  }
                  if (item.id === "txn-requests") {
                    return (
                      <DistributorMetricCard
                        key={item.id}
                        variant="tile"
                        tileTone={tileTone}
                        href={item.href}
                        icon={ArrowLeftRight}
                        label={item.label}
                        value={String(pendingTxnRequests)}
                        hint={`${txnRequests.length} total`}
                      />
                    );
                  }
                  if (item.id === "transaction-groups") {
                    return (
                      <DistributorMetricCard
                        key={item.id}
                        variant="tile"
                        tileTone={tileTone}
                        href={item.href}
                        icon={FolderKanban}
                        label={item.label}
                        value="0"
                        hint="No open groups"
                      />
                    );
                  }
                  return (
                    <DistributorMetricCard
                      key={item.id}
                      variant="tile"
                      tileTone={tileTone}
                      href={item.href}
                      icon={Layers3}
                      label={item.label}
                      value="—"
                    />
                  );
                })}
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
