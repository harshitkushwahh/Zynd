"use client";

import {
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers,
  Layers3,
  PauseCircle,
  Send,
  XCircle,
} from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";

type YourOperationsSectionMetricsProps = {
  sectionId: DistributorOperationsSectionId;
};

function TxnRequestsSectionMetrics() {
  const { requests } = useDistributorTxnRequests();
  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const rejectedCount = requests.filter((r) => r.status === "Rejected").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DistributorMetricCard
        icon={ArrowLeftRight}
        label="Total requests"
        value={String(requests.length)}
        hint="In demo queue"
      />
      <DistributorMetricCard
        icon={Clock3}
        label="Pending"
        value={String(pendingCount)}
        hint="Awaiting action"
      />
      <DistributorMetricCard
        icon={CheckCircle2}
        label="Approved"
        value={String(approvedCount)}
        hint="Processed"
      />
      <DistributorMetricCard
        icon={XCircle}
        label="Rejected"
        value={String(rejectedCount)}
        hint="Declined"
      />
    </div>
  );
}

export function YourOperationsSectionMetrics({ sectionId }: YourOperationsSectionMetricsProps) {
  if (sectionId === "orders") {
    const pendingCount = DUMMY_ORDERS.filter(
      (o) => o.status === "Pending" || o.status === "Processing",
    ).length;
    const completedCount = DUMMY_ORDERS.filter((o) => o.status === "Completed").length;
    const failedCount = DUMMY_ORDERS.filter((o) => o.status === "Failed").length;

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={Layers3}
          label="Total orders"
          value={String(DUMMY_ORDERS.length)}
          hint="In demo book"
        />
        <DistributorMetricCard
          icon={Clock3}
          label="Open"
          value={String(pendingCount)}
          hint="Pending or processing"
        />
        <DistributorMetricCard
          icon={CheckCircle2}
          label="Completed"
          value={String(completedCount)}
          hint="Successfully processed"
        />
        <DistributorMetricCard
          icon={XCircle}
          label="Failed"
          value={String(failedCount)}
          hint="Needs follow-up"
        />
      </div>
    );
  }

  if (sectionId === "systematic-plans") {
    const activeCount = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.status === "Active").length;
    const pausedCount = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.status === "Paused").length;
    const cancelledCount = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.status === "Cancelled").length;

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={CalendarClock}
          label="Total plans"
          value={String(DUMMY_SYSTEMATIC_PLANS.length)}
          hint="SIP, STP, and SWP"
        />
        <DistributorMetricCard
          icon={CheckCircle2}
          label="Active"
          value={String(activeCount)}
          hint="Currently running"
        />
        <DistributorMetricCard
          icon={PauseCircle}
          label="Paused"
          value={String(pausedCount)}
          hint="Temporarily stopped"
        />
        <DistributorMetricCard
          icon={XCircle}
          label="Cancelled"
          value={String(cancelledCount)}
          hint="Closed plans"
        />
      </div>
    );
  }

  if (sectionId === "txn-requests") {
    return <TxnRequestsSectionMetrics />;
  }

  const draftCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Draft").length;
  const submittedCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Submitted").length;
  const completedCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Completed").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DistributorMetricCard
        icon={FolderKanban}
        label="Total groups"
        value={String(DUMMY_TRANSACTION_GROUPS.length)}
        hint="Multi-leg batches"
      />
      <DistributorMetricCard icon={Layers} label="Draft" value={String(draftCount)} hint="Not yet submitted" />
      <DistributorMetricCard
        icon={Send}
        label="Submitted"
        value={String(submittedCount)}
        hint="In processing"
      />
      <DistributorMetricCard
        icon={CheckCircle2}
        label="Completed"
        value={String(completedCount)}
        hint="Fully processed"
      />
    </div>
  );
}
