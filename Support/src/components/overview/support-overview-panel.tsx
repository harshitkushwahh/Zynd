"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Layers3, Ticket } from "lucide-react";

import { DistributorOverviewSection } from "@/components/overview/distributor-overview-section";
import { SupportDashboardGreeting } from "@/components/overview/support-dashboard-greeting";
import { SupportOverviewCategoryCard } from "@/components/overview/support-overview-category-card";
import { SupportOverviewMetricTile } from "@/components/overview/support-overview-metric-tile";
import { SupportOverviewPerformanceCards } from "@/components/overview/support-overview-performance-cards";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { SupportOverviewTicketTrendsCard } from "@/components/overview/support-overview-ticket-trends-card";
import { SupportTicketsTable } from "@/components/tickets/support-tickets-table";
import { useSupportAuth } from "@/contexts/support-auth-context";
import { buildSupportOverviewAnalytics } from "@/lib/support-overview-analytics";
import { filterTicketsForAgentQueue, sortTicketsByRecentActivity } from "@/lib/support-overview-ticket-stats";
import { listSupportTickets } from "@/lib/support-tickets-api";
import type { SupportTicket } from "@/lib/support-types";
import { DISTRIBUTOR_DASHBOARD_HOME_SPACER_CLASS, DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

const RECENT_TICKET_LIMIT = 6;

export function SupportOverviewPanel() {
  const { displayName, user } = useSupportAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTicketsLoading(true);
    void listSupportTickets({ queue: "all" })
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(
    () => buildSupportOverviewAnalytics(tickets, user?.id),
    [tickets, user?.id],
  );

  const agentTickets = useMemo(
    () => filterTicketsForAgentQueue(tickets, user?.id),
    [tickets, user?.id],
  );

  const recentTickets = useMemo(
    () => sortTicketsByRecentActivity(agentTickets).slice(0, RECENT_TICKET_LIMIT),
    [agentTickets],
  );

  const metricValues = {
    total: String(analytics.summary.total),
    open: String(analytics.summary.open),
    inProgress: String(analytics.summary.inProgress),
    resolved: String(analytics.summary.resolved),
  };

  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        DISTRIBUTOR_DASHBOARD_HOME_SPACER_CLASS,
        "distributor-dashboard-page--enter",
      )}
    >
      <SupportDashboardGreeting name={displayName} />

      <div className="support-overview-metrics-grid distributor-metric-tiles-grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SupportOverviewMetricTile
          icon={Layers3}
          label="My queue"
          value={metricValues.total}
          trendPct={analytics.metricTrends.total}
          sparkline={analytics.sparklines.total}
          href="/dashboard/tickets"
          tileTone="accent"
        />
        <SupportOverviewMetricTile
          icon={Ticket}
          label="Open tickets"
          value={metricValues.open}
          trendPct={analytics.metricTrends.open}
          sparkline={analytics.sparklines.open}
          href="/dashboard/tickets"
        />
        <SupportOverviewMetricTile
          icon={Clock3}
          label="In progress"
          value={metricValues.inProgress}
          trendPct={analytics.metricTrends.inProgress}
          sparkline={analytics.sparklines.inProgress}
          href="/dashboard/tickets"
        />
        <SupportOverviewMetricTile
          icon={CheckCircle2}
          label="Resolved"
          value={metricValues.resolved}
          trendPct={analytics.metricTrends.resolved}
          sparkline={analytics.sparklines.resolved}
          href="/dashboard/tickets"
        />
      </div>

      <div className="support-overview-insights-row grid items-stretch gap-3 xl:grid-cols-3">
        <div className="flex min-h-0 min-w-0 xl:col-span-2">
          <SupportOverviewTicketTrendsCard
            className="min-w-0 flex-1"
            series={analytics.trends}
          />
        </div>
        <div className="flex min-h-0 min-w-0">
          <SupportOverviewCategoryCard
            className="min-w-0 flex-1"
            segments={analytics.categories}
          />
        </div>
      </div>

      <SupportOverviewPerformanceCards performance={analytics.performance} />

      <DistributorOverviewSection
        title="Recent tickets"
        actions={
          <DistributorActionButton variant="chevron" size="sm" asChild>
            <Link href="/dashboard/tickets">View all tickets</Link>
          </DistributorActionButton>
        }
      >
        <SupportTicketsTable
          tickets={recentTickets}
          isLoading={ticketsLoading}
          showToolbar={false}
          showUserColumn
          emptyTitle="No tickets in your queue"
        />
      </DistributorOverviewSection>
    </div>
  );
}
