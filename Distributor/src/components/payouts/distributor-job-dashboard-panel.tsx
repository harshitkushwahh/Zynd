"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { useDistributorScopePageReveal } from "@/components/dashboard/use-distributor-scope-page-reveal";
import { DistributorJobDashboardPageSkeleton } from "@/components/payouts/distributor-job-dashboard-page-skeleton";
import { DistributorJobPeriodSelect } from "@/components/payouts/distributor-job-period-select";
import { DistributorPayrollBreakdownCard } from "@/components/payouts/distributor-payroll-breakdown-card";
import { DistributorJobSectionMetrics } from "@/components/payouts/distributor-job-section-metrics";
import { DistributorWorkAttendanceCard } from "@/components/payouts/distributor-work-attendance-card";
import { DistributorLeavePanel } from "@/components/payouts/distributor-leave-panel";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableCardShell } from "@/components/dashboard/distributor-table-card-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  DUMMY_DISTRIBUTOR_PAYOUTS,
  type DistributorPayoutRow,
  type DistributorPayoutStatus,
} from "@/lib/dummy/distributor-payouts";
import { CURRENT_PAYROLL_ID } from "@/lib/dummy/distributor-job-dashboard";
import { DISTRIBUTOR_PAGE_STACK_CLASS, DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const COMMISSION_STATUS_OPTIONS: Array<{ value: DistributorPayoutStatus; label: string }> = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Processing", label: "Processing" },
  { value: "Paid", label: "Paid" },
  { value: "Failed", label: "Failed" },
];

function payoutStatusVariant(status: DistributorPayoutStatus): StatusBadgeVariant {
  if (status === "Paid") return "success";
  if (status === "Scheduled" || status === "Processing") return "neutral";
  return "destructive";
}

function formatInr(amount: number): string {
  return formatAum(amount).replace(/\.00$/, "");
}

type DistributorJobDashboardPanelProps = DistributorPageConfig;

export function DistributorJobDashboardPanel({ title }: DistributorJobDashboardPanelProps) {
  const { showSkeleton } = useDistributorScopePageReveal();
  const commissionRows = DUMMY_DISTRIBUTOR_PAYOUTS;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState(CURRENT_PAYROLL_ID);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<DistributorPayoutStatus | "all">("all");
  const [commissionSort, setCommissionSort] = useState<SortDescriptor>({
    column: "settlementDate",
    direction: "descending",
  });

  const filteredCommission = useMemo(() => {
    return commissionRows.filter((row) => {
      if (commissionStatusFilter !== "all" && row.status !== commissionStatusFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        row.payoutRef,
        row.periodLabel,
        row.bankAccountMasked,
        row.status,
      );
    });
  }, [commissionRows, commissionStatusFilter, searchQuery]);

  const sortedCommission = useMemo(
    () => sortByDescriptor(filteredCommission, commissionSort),
    [filteredCommission, commissionSort],
  );

  const {
    pageItems: commissionPageItems,
    pagination: commissionPagination,
    setPage: setCommissionPage,
  } = useDistributorTablePagination(sortedCommission);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setCommissionStatusFilter("all");
        setCommissionPage(1);
      }}
      clearDisabled={commissionStatusFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setCommissionPage(1);
          }}
          placeholder="Search commission payouts…"
          aria-label="Search commission payouts"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={commissionStatusFilter}
        options={COMMISSION_STATUS_OPTIONS}
        onValueChange={(value) => {
          setCommissionStatusFilter(value);
          setCommissionPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const commissionTable = wrapDistributorTableBody(
    <Table
      key="job-history-commission"
      aria-label="Commission payouts"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={commissionSort}
      onSortChange={(descriptor) => {
        setCommissionSort(descriptor);
        setCommissionPage(1);
      }}
      pagination={commissionPagination}
    >
      <Table.Header>
        <Table.Head id="payoutRef" label="Payout" isRowHeader allowsSorting />
        <Table.Head id="periodLabel" label="Period" allowsSorting />
        <Table.Head
          id="netAmount"
          label="Net amount"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head
          id="settlementDate"
          label="Settlement"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="bankAccountMasked" label="Account" allowsSorting />
      </Table.Header>
      <Table.Body items={commissionPageItems}>
        {(row: DistributorPayoutRow) => (
          <Table.Row id={row.id}>
            <Table.Cell>
              <p className="font-mono text-caption font-medium">{row.payoutRef}</p>
              {row.holdAmount > 0 ? (
                <p className="text-caption text-muted-foreground">Hold {formatInr(row.holdAmount)}</p>
              ) : null}
            </Table.Cell>
            <Table.Cell>{row.periodLabel}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatInr(row.netAmount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={payoutStatusVariant(row.status)}>
                {row.status}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
              {formatDistributorDate(row.settlementDate)}
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{row.bankAccountMasked}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  if (showSkeleton) {
    return <DistributorJobDashboardPageSkeleton />;
  }

  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        "distributor-job-dashboard-page distributor-scope-page--enter",
      )}
    >
      <DistributorPageHeader title={title} description="">
        <DistributorJobPeriodSelect value={selectedPeriodId} onValueChange={setSelectedPeriodId} />
      </DistributorPageHeader>

      <DistributorJobSectionMetrics />

      <div className="distributor-job-dashboard__widget-row" aria-label="Payroll and attendance widgets">
        <DistributorPayrollBreakdownCard
          variant="dashboard"
          className="distributor-job-dashboard-widget"
        />
        <DistributorWorkAttendanceCard
          variant="sidebar"
          className="distributor-job-dashboard-widget"
        />
        <DistributorLeavePanel variant="sidebar" className="distributor-job-dashboard-widget" />
      </div>

      <DistributorTableCardShell
        toolbar={toolbar}
        isEmpty={commissionPageItems.length === 0}
        emptyTitle="No commission payouts found"
        emptyDescription="Try adjusting your search or status filter."
        tableSize="sm"
      >
        {commissionTable}
      </DistributorTableCardShell>
    </div>
  );
}
