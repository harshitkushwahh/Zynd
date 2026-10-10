"use client";

import Link from "next/link";
import { useMemo } from "react";
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
import {
  SUPPORT_OVERVIEW_CATEGORY_SEGMENTS,
  SUPPORT_OVERVIEW_METRIC_TRENDS,
  SUPPORT_OVERVIEW_SPARKLINE,
  SUPPORT_OVERVIEW_TICKET_TRENDS,
} from "@/lib/support-overview-analytics-data";
import {
  filterTicketsForAgentQueue,
  sortTicketsByRecentActivity,
  summarizeAgentTicketQueue,
} from "@/lib/support-overview-ticket-stats";
import { SUPPORT_DUMMY_TICKETS } from "@/lib/support-tickets-dummy-data";
import { DISTRIBUTOR_DASHBOARD_HOME_SPACER_CLASS, DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

const RECENT_TICKET_LIMIT = 6;

export function SupportOverviewPanel() {
  const { displayName } = useSupportAuth();

  const agentTickets = useMemo(
    () => filterTicketsForAgentQueue(SUPPORT_DUMMY_TICKETS),
    [],
  );

  const queueSummary = useMemo(() => summarizeAgentTicketQueue(agentTickets), [agentTickets]);

  const recentTickets = useMemo(
    () => sortTicketsByRecentActivity(agentTickets).slice(0, RECENT_TICKET_LIMIT),
    [agentTickets],
  );

  const metricValues = {
    total: String(queueSummary.total),
    open: String(queueSummary.open),
    inProgress: String(queueSummary.inProgress),
    resolved: String(queueSummary.resolved),
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
          trendPct={SUPPORT_OVERVIEW_METRIC_TRENDS.total}
          sparkline={SUPPORT_OVERVIEW_SPARKLINE.total}
          href="/dashboard/tickets"
          tileTone="accent"
        />
        <SupportOverviewMetricTile
          icon={Ticket}
          label="Open tickets"
          value={metricValues.open}
          trendPct={SUPPORT_OVERVIEW_METRIC_TRENDS.open}
          sparkline={SUPPORT_OVERVIEW_SPARKLINE.open}
          href="/dashboard/tickets"
        />
        <SupportOverviewMetricTile
          icon={Clock3}
          label="In progress"
          value={metricValues.inProgress}
          trendPct={SUPPORT_OVERVIEW_METRIC_TRENDS.inProgress}
          sparkline={SUPPORT_OVERVIEW_SPARKLINE.inProgress}
          href="/dashboard/tickets"
        />
        <SupportOverviewMetricTile
          icon={CheckCircle2}
          label="Resolved"
          value={metricValues.resolved}
          trendPct={SUPPORT_OVERVIEW_METRIC_TRENDS.resolved}
          sparkline={SUPPORT_OVERVIEW_SPARKLINE.resolved}
          href="/dashboard/tickets"
        />
      </div>

      <div className="support-overview-insights-row grid items-stretch gap-3 xl:grid-cols-3">
        <div className="flex min-h-0 min-w-0 xl:col-span-2">
          <SupportOverviewTicketTrendsCard
            className="min-w-0 flex-1"
            series={SUPPORT_OVERVIEW_TICKET_TRENDS}
          />
        </div>
        <div className="flex min-h-0 min-w-0">
          <SupportOverviewCategoryCard
            className="min-w-0 flex-1"
            segments={SUPPORT_OVERVIEW_CATEGORY_SEGMENTS}
          />
        </div>
      </div>

      <SupportOverviewPerformanceCards />

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
          showToolbar={false}
          showUserColumn
          emptyTitle="No tickets in your queue"
        />
      </DistributorOverviewSection>
    </div>
  );
}
