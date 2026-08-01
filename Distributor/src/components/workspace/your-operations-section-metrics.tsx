"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers,
  Layers3,
  PauseCircle,
  Repeat,
  Users,
  XCircle,
} from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorOperationsDualRingCard } from "@/components/workspace/your-orders-dual-ring-card";
import { DistributorOrdersMonthlyVolumeCard } from "@/components/workspace/your-orders-monthly-volume-card";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import { DISTRIBUTOR_METRIC_TILE_CELL_CLASS, DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS } from "@/lib/distributor-layout";
import {
  getScopedOrders,
  getScopedSystematicPlans,
  getScopedTransactionGroups,
  getScopedTxnRequests,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import {
  getOperationsDualRingMetrics,
  getTransactionGroupsDualRing,
  getYourOrdersDualRing,
  getYourOrdersOperationMix,
} from "@/lib/your-operations-dual-ring";
import {
  getTransactionGroupsMonthlyVolume,
  getYourOrdersMonthlyVolume,
  type YourOrdersMonthlyVolume,
} from "@/lib/your-orders-metrics";
import { cn } from "@/lib/utils";

type YourOperationsSectionMetricsProps = {
  sectionId: DistributorOperationsSectionId;
  operationsListScope?: DistributorOrdersListScope;
  /** @deprecated Use operationsListScope */
  ordersListScope?: DistributorOrdersListScope;
  className?: string;
};

const INSIGHTS_RATIO_CLASS =
  "distributor-your-clients-metrics__cell distributor-your-clients-metrics__ratio min-w-0 shrink-0";
const INSIGHTS_SUMMARY_CLASS =
  "distributor-your-clients-metrics__cell distributor-your-clients-metrics__summary min-w-0 shrink-0";

function OperationsMetricsWithInsights({
  children,
  sectionId,
  monthlyVolume,
  operationsListScope = "your-book",
}: {
  children: ReactNode;
  sectionId: DistributorOperationsSectionId;
  monthlyVolume: YourOrdersMonthlyVolume;
  operationsListScope?: DistributorOrdersListScope;
}) {
  const dualRing = useMemo(() => {
    if (sectionId === "orders") {
      const orders = getScopedOrders(operationsListScope);
      return getOperationsDualRingMetrics("orders", getYourOrdersOperationMix(orders));
    }
    if (sectionId === "systematic-plans") {
      const plans = getScopedSystematicPlans(operationsListScope);
      const total = plans.length;
      const sip = plans.filter((p) => p.planType === "SIP").length;
      const stp = plans.filter((p) => p.planType === "STP").length;
      const pct = (part: number) => (total <= 0 ? 0 : Math.round((part / total) * 100));
      return {
        outerPct: pct(sip),
        innerPct: pct(stp),
        outerLabel: "SIP",
        innerLabel: "STP",
        outerRatio: `${sip}/${total}`,
        innerRatio: `${stp}/${total}`,
        denominator: total,
      };
    }
    if (sectionId === "txn-requests") {
      return getOperationsDualRingMetrics("txn-requests");
    }
    if (sectionId === "transaction-groups") {
      const scopedGroups = getScopedTransactionGroups(operationsListScope);
      const mix = {
        total: scopedGroups.length,
        oneTime: scopedGroups.filter((g) => /lump|one.?time/i.test(g.label)).length,
        groupTransaction: scopedGroups.filter((g) => /group/i.test(g.label)).length,
        sips: scopedGroups.filter((g) => /sip/i.test(g.label)).length,
      };
      return getTransactionGroupsDualRing(mix);
    }
    return getYourOrdersDualRing(getYourOrdersOperationMix([]));
  }, [operationsListScope, sectionId]);

  return (
    <div className={DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS}>
      {children}
      <DistributorOperationsDualRingCard className={INSIGHTS_RATIO_CLASS} metrics={dualRing} />
      <DistributorOrdersMonthlyVolumeCard className={INSIGHTS_SUMMARY_CLASS} volume={monthlyVolume} />
    </div>
  );
}

export function OrdersSectionMetricTiles({
  ordersListScope = "your-book",
}: {
  ordersListScope?: DistributorOrdersListScope;
}) {
  const scopedOrders = useMemo(() => getScopedOrders(ordersListScope), [ordersListScope]);
  const mix = useMemo(() => getYourOrdersOperationMix(scopedOrders), [scopedOrders]);
  const monthlyVolume = useMemo(() => getYourOrdersMonthlyVolume(scopedOrders), [scopedOrders]);
  const bookHint = ordersListScope === "all" ? "Platform-wide (demo)" : "In demo book";

  return (
    <OperationsMetricsWithInsights
      sectionId="orders"
      monthlyVolume={monthlyVolume}
      operationsListScope={ordersListScope}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={Layers3}
        label="Total orders"
        value={String(mix.total)}
        hint={bookHint}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Layers}
        label="One time"
        value={String(mix.oneTime)}
        hint="Lumpsum & switch"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Repeat}
        label="SIP"
        value={String(mix.sip)}
        hint="Installment orders"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={ArrowDownLeft}
        label="Redemption"
        value={String(mix.redemption)}
        hint="Redeem orders"
        showTileAction={false}
      />
    </OperationsMetricsWithInsights>
  );
}

function TxnRequestsSectionMetrics({
  operationsListScope = "your-book",
}: {
  operationsListScope?: DistributorOrdersListScope;
}) {
  const { requests: allRequests } = useDistributorTxnRequests();
  const requests = useMemo(
    () => getScopedTxnRequests(allRequests, operationsListScope),
    [allRequests, operationsListScope],
  );
  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const rejectedCount = requests.filter((r) => r.status === "Rejected").length;
  const monthlyVolume = useMemo(
    () => ({
      title: "Monthly requests",
      bars: [
        { month: "Apr", count: 4, amount: 8200, isCurrent: false },
        { month: "May", count: 3, amount: 6100, isCurrent: false },
        { month: "Jun", count: 5, amount: 9400, isCurrent: false },
        { month: "Jul", count: 4, amount: 7200, isCurrent: false },
        { month: "Aug", count: requests.length, amount: 8800, isCurrent: true },
      ],
      currentMonthAmount: 8800,
      currentMonthCount: requests.length,
    }),
    [requests.length],
  );

  return (
    <OperationsMetricsWithInsights
      sectionId="txn-requests"
      monthlyVolume={monthlyVolume}
      operationsListScope={operationsListScope}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={ArrowLeftRight}
        label="Total requests"
        value={String(requests.length)}
        hint="In demo queue"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Clock3}
        label="Pending"
        value={String(pendingCount)}
        hint="Awaiting action"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={CheckCircle2}
        label="Approved"
        value={String(approvedCount)}
        hint="Processed"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={XCircle}
        label="Rejected"
        value={String(rejectedCount)}
        hint="Declined"
        showTileAction={false}
      />
    </OperationsMetricsWithInsights>
  );
}

function TransactionGroupsSectionMetrics({
  operationsListScope = "your-book",
}: {
  operationsListScope?: DistributorOrdersListScope;
}) {
  const groups = useMemo(
    () => getScopedTransactionGroups(operationsListScope),
    [operationsListScope],
  );
  const mix = useMemo(() => {
    const total = groups.length;
    return {
      total,
      oneTime: groups.filter((g) => /lump|one.?time/i.test(g.label)).length,
      groupTransaction: groups.filter((g) => /group/i.test(g.label)).length,
      sips: groups.filter((g) => /sip/i.test(g.label)).length,
    };
  }, [groups]);
  const monthlyVolume = useMemo(() => getTransactionGroupsMonthlyVolume(), []);

  return (
    <OperationsMetricsWithInsights
      sectionId="transaction-groups"
      monthlyVolume={monthlyVolume}
      operationsListScope={operationsListScope}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={FolderKanban}
        label="Total groups"
        value={String(mix.total)}
        hint="Multi-leg batches"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Layers}
        label="One time"
        value={String(mix.oneTime)}
        hint="Single-leg batches"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Users}
        label="Group transaction"
        value={String(mix.groupTransaction)}
        hint="Grouped legs"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={Repeat}
        label="SIPs"
        value={String(mix.sips)}
        hint="SIP batches"
        showTileAction={false}
      />
    </OperationsMetricsWithInsights>
  );
}

function SystematicPlansSectionMetrics({
  operationsListScope = "your-book",
}: {
  operationsListScope?: DistributorOrdersListScope;
}) {
  const plans = useMemo(
    () => getScopedSystematicPlans(operationsListScope),
    [operationsListScope],
  );
  const activeCount = plans.filter((p) => p.status === "Active").length;
  const pausedCount = plans.filter((p) => p.status === "Paused").length;
  const cancelledCount = plans.filter((p) => p.status === "Cancelled").length;
  const bookHint = operationsListScope === "all" ? "Platform-wide (demo)" : "Your client plans";
  const monthlyVolume = useMemo(
    () => ({
      title: "Monthly plans",
      bars: [
        { month: "Apr", count: 2, amount: 6000, isCurrent: false },
        { month: "May", count: 3, amount: 7500, isCurrent: false },
        { month: "Jun", count: 2, amount: 5000, isCurrent: false },
        { month: "Jul", count: 4, amount: 9000, isCurrent: false },
        {
          month: "Aug",
          count: plans.length,
          amount: 8500,
          isCurrent: true,
        },
      ],
      currentMonthAmount: 8500,
      currentMonthCount: plans.length,
    }),
    [plans.length],
  );

  return (
    <OperationsMetricsWithInsights
      sectionId="systematic-plans"
      monthlyVolume={monthlyVolume}
      operationsListScope={operationsListScope}
    >
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        tileTone="accent"
        icon={CalendarClock}
        label="Total plans"
        value={String(plans.length)}
        hint={bookHint}
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={CheckCircle2}
        label="Active"
        value={String(activeCount)}
        hint="Currently running"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={PauseCircle}
        label="Paused"
        value={String(pausedCount)}
        hint="Temporarily stopped"
        showTileAction={false}
      />
      <DistributorMetricCard
        className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
        variant="tile"
        icon={XCircle}
        label="Cancelled"
        value={String(cancelledCount)}
        hint="Closed plans"
        showTileAction={false}
      />
    </OperationsMetricsWithInsights>
  );
}

export function YourOperationsSectionMetrics({
  sectionId,
  operationsListScope,
  ordersListScope,
  className,
}: YourOperationsSectionMetricsProps) {
  const listScope = operationsListScope ?? ordersListScope ?? "your-book";

  let content: ReactNode = null;

  if (sectionId === "orders") {
    content = <OrdersSectionMetricTiles ordersListScope={listScope} />;
  } else if (sectionId === "systematic-plans") {
    content = <SystematicPlansSectionMetrics operationsListScope={listScope} />;
  } else if (sectionId === "txn-requests") {
    content = <TxnRequestsSectionMetrics operationsListScope={listScope} />;
  } else {
    content = <TransactionGroupsSectionMetrics operationsListScope={listScope} />;
  }

  return (
    <div className={cn(className)}>
      {content}
    </div>
  );
}
