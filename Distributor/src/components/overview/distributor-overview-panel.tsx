"use client";

import Link from "next/link";
import { CalendarClock, FolderKanban, IndianRupee, Layers3, Users, ArrowLeftRight } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";
import { DistributorOverviewSection } from "@/components/overview/distributor-overview-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SYSTEM_RESIDENT_INVESTORS_HREF, YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import { DUMMY_INVESTORS, filterDistributorBookInvestors, filterSystemResidentInvestors } from "@/lib/dummy/investors";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { getDistributorNavGroup } from "@/lib/distributor-navigation";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { orderStatusVariant } from "@/lib/status-meta";

const bookClients = filterDistributorBookInvestors(DUMMY_INVESTORS);
const systemResidents = filterSystemResidentInvestors(DUMMY_INVESTORS);
const bookOnboarded = bookClients.filter((i) => i.onboardingStatus === "Onboarded").length;
const systemAum = systemResidents.reduce((sum, i) => sum + (i.aum ?? 0), 0);
const pendingOrders = DUMMY_ORDERS.filter((o) => o.status === "Pending" || o.status === "Processing").length;
const activePlans = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.status === "Active").length;
const recentOrders = [...DUMMY_ORDERS]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  .slice(0, 5);

export function DistributorOverviewPanel({
  iconName,
  title,
  description,
}: {
  iconName: DistributorPageIconName;
  title: string;
  description: string;
}) {
  const { requests: txnRequests } = useDistributorTxnRequests();
  const pendingTxnRequests = txnRequests.filter((r) => r.status === "Pending").length;
  const Icon = resolveDistributorPageIcon(iconName);
  const investorsGroup = getDistributorNavGroup("investors");
  const operationsGroup = getDistributorNavGroup("operations");
  const openTransactionGroups = DUMMY_TRANSACTION_GROUPS.filter(
    (group) => group.status === "Draft" || group.status === "Submitted",
  ).length;

  return (
    <div className="space-y-8">
      <DistributorPageHeader icon={Icon} title={title} description={description} />

      {investorsGroup ? (
        <DistributorOverviewSection title={investorsGroup.label}>
          <div className="grid gap-3 sm:grid-cols-2">
            <DistributorMetricCard
              icon={Users}
              label="Your clients"
              value={String(bookClients.length)}
              hint={`${bookOnboarded} onboarded · added by you`}
              href={YOUR_CLIENTS_LIST_HREF}
            />
            <DistributorMetricCard
              icon={Users}
              label="All residents"
              value={String(systemResidents.length)}
              hint="PM & DIY on platform"
              href={SYSTEM_RESIDENT_INVESTORS_HREF}
            />
            <DistributorMetricCard
              icon={IndianRupee}
              label="Resident AUM"
              value={formatAum(systemAum)}
              hint="Platform-wide (demo)"
              href={SYSTEM_RESIDENT_INVESTORS_HREF}
            />
          </div>
        </DistributorOverviewSection>
      ) : null}

      {operationsGroup ? (
        <DistributorOverviewSection title={operationsGroup.label}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DistributorMetricCard
              icon={Layers3}
              label="Open orders"
              value={String(pendingOrders)}
              hint={`${DUMMY_ORDERS.length} total in demo`}
              href="/dashboard/your-operations"
            />
            <DistributorMetricCard
              icon={CalendarClock}
              label="Active SIPs"
              value={String(activePlans)}
              hint="Systematic plans"
              href="/dashboard/your-operations"
            />
            <DistributorMetricCard
              icon={ArrowLeftRight}
              label="Pending approvals"
              value={String(pendingTxnRequests)}
              hint="Txn requests awaiting action"
              href="/dashboard/your-operations"
            />
            <DistributorMetricCard
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
        </DistributorOverviewSection>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-body">Recent orders</CardTitle>
          <Link href="/dashboard/orders" className="text-caption text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-2 p-0 px-4 pb-4">
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href="/dashboard/orders"
              className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 px-3 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-compact font-medium text-foreground">
                  {order.orderRef}
                </p>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  {order.schemeName} · {order.clientCode}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge variant={orderStatusVariant(order.status)}>{order.status}</StatusBadge>
                <span className="text-caption text-muted-foreground">
                  {formatDistributorDate(order.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
