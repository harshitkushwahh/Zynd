"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  getScopedSystematicPlans,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DistributorSystematicPlan, SystematicPlanStatus } from "@/lib/dummy/types";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { planStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: SystematicPlanStatus; label: string }> = [
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Cancelled", label: "Cancelled" },
];

type PlanTypeFilter = DistributorSystematicPlan["planType"] | "all";

const PLAN_TYPE_OPTIONS: Array<{ value: PlanTypeFilter; label: string }> = [
  { value: "SIP", label: "SIP" },
  { value: "STP", label: "STP" },
  { value: "SWP", label: "SWP" },
];

type SystematicPlansPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
  operationsListScope?: DistributorOrdersListScope;
};

export function SystematicPlansPanel({
  title,
  description,
  layout = "page",
  operationsListScope = "your-book",
}: SystematicPlansPanelProps) {
  const sourcePlans = useMemo(
    () => getScopedSystematicPlans(operationsListScope),
    [operationsListScope],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SystematicPlanStatus | "all">("all");
  const [planTypeFilter, setPlanTypeFilter] = useState<PlanTypeFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "nextDueAt",
    direction: "ascending",
  });

  const filtered = useMemo(() => {
    return sourcePlans.filter((plan) => {
      if (statusFilter !== "all" && plan.status !== statusFilter) return false;
      if (planTypeFilter !== "all" && plan.planType !== planTypeFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        plan.planRef,
        plan.clientCode,
        plan.investorEmailMasked,
        plan.schemeName,
        plan.planType,
      );
    });
  }, [planTypeFilter, searchQuery, sourcePlans, statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const activeCount = sourcePlans.filter((p) => p.status === "Active").length;
  const pausedCount = sourcePlans.filter((p) => p.status === "Paused").length;
  const cancelledCount = sourcePlans.filter((p) => p.status === "Cancelled").length;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setPlanTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={
        statusFilter === "all" && planTypeFilter === "all" && searchQuery.trim() === ""
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search plans…"
          aria-label="Search systematic plans"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Plan type"
        value={planTypeFilter}
        options={PLAN_TYPE_OPTIONS}
        onValueChange={(value) => {
          setPlanTypeFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
        aria-label="Systematic plans"
        className="min-w-[var(--table-min-width-4xl)]"
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor);
          setPage(1);
        }}
        pagination={pagination}
      >
        <Table.Header>
          <Table.Head id="planRef" label="Plan" isRowHeader allowsSorting />
          <Table.Head id="investorEmailMasked" label="Investor" allowsSorting />
          <Table.Head id="schemeName" label="Scheme" allowsSorting />
          <Table.Head id="planType" label="Type" allowsSorting />
          <Table.Head id="frequency" label="Frequency" allowsSorting />
          <Table.Head
            id="amount"
            label="Amount"
            allowsSorting
            className="text-right [&>div]:justify-end"
          />
          <Table.Head id="status" label="Status" allowsSorting />
          <Table.Head
            id="nextDueAt"
            label="Next due"
            allowsSorting
            className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
          />
        </Table.Header>
        <Table.Body items={pageItems}>
          {(plan) => (
            <Table.Row id={plan.id}>
              <Table.Cell>
                <p className="font-mono text-caption font-medium">{plan.planRef}</p>
                <p className="text-caption text-muted-foreground">{plan.clientCode}</p>
              </Table.Cell>
              <Table.Cell className="text-muted-foreground">{plan.investorEmailMasked}</Table.Cell>
              <Table.Cell>{plan.schemeName}</Table.Cell>
              <Table.Cell className="text-muted-foreground">{plan.planType}</Table.Cell>
              <Table.Cell className="text-muted-foreground">{plan.frequency}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">{formatAum(plan.amount)}</Table.Cell>
              <Table.Cell>
                <StatusBadge variant={planStatusVariant(plan.status)}>{plan.status}</StatusBadge>
              </Table.Cell>
              <Table.Cell
                className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
              >
                {formatDistributorDate(plan.nextDueAt)}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
    </Table>,
  );

  if (layout === "table") {
    return (
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No plans match your filters"
        emptyDescription="Adjust filters, search, or clear all to reset."
      >
        {table}
      </DistributorTableOnlyShell>
    );
  }

  return (
    <DistributorPageShell
      title={title}
      description={description}
      isEmpty={sorted.length === 0}
      emptyTitle="No plans match your filters"
      emptyDescription="Adjust filters, search, or clear all to reset."
      metrics={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DistributorMetricCard
            icon={CalendarClock}
            label="Total plans"
            value={String(sourcePlans.length)}
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
      }
      toolbar={toolbar}
    >
      {table}
    </DistributorPageShell>
  );
}
