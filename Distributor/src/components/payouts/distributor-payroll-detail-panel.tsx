"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { CalendarRange, Gift, Wallet } from "lucide-react";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableCardShell } from "@/components/dashboard/distributor-table-card-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import {
  DUMMY_DISTRIBUTOR_SALARY_SLIPS,
  SALARY_PAYMENT_STATUS_OPTIONS,
  getSalaryPaymentStatusLabel,
  getPayrollHistorySummary,
  type DistributorSalaryPaymentStatus,
  type DistributorSalarySlipRow,
} from "@/lib/dummy/distributor-job-dashboard";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate, formatPortfolioMetricAmount } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

type DistributorPayrollDetailPanelProps = DistributorPageConfig;

function salaryStatusVariant(status: DistributorSalaryPaymentStatus): StatusBadgeVariant {
  if (status === "done") return "success";
  if (status === "waiting") return "warning";
  if (status === "partial") return "info";
  return "destructive";
}

function formatInr(amount: number): string {
  return formatAum(amount).replace(/\.00$/, "");
}

function formatTileAmount(amount: number): { display: string; title: string } {
  return {
    display: formatPortfolioMetricAmount(amount),
    title: formatAum(amount),
  };
}

export function DistributorPayrollDetailPanel({ title }: DistributorPayrollDetailPanelProps) {
  const rows = DUMMY_DISTRIBUTOR_SALARY_SLIPS;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DistributorSalaryPaymentStatus | "all">("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "paidOn", direction: "descending" });

  const summary = useMemo(() => getPayrollHistorySummary(rows), [rows]);
  const ytdPaid = formatTileAmount(summary.ytdPaid);
  const avgVariablePay = formatTileAmount(summary.avgVariablePay);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return distributorTableSearchMatch(
        query,
        row.periodLabel,
        row.status,
        getSalaryPaymentStatusLabel(row.status),
      );
    });
  }, [rows, searchQuery, statusFilter]);

  const sortedRows = useMemo(
    () => sortByDescriptor(filteredRows, sort),
    [filteredRows, sort],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sortedRows);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setPage(1);
      }}
      clearDisabled={statusFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search payroll history…"
          aria-label="Search payroll history"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={SALARY_PAYMENT_STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Payroll history"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sort}
      onSortChange={(descriptor) => {
        setSort(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="periodLabel" label="Period" isRowHeader allowsSorting />
        <Table.Head
          id="basicSalary"
          label="Base"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="performanceIncentive"
          label="Performance"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="spotBonus"
          label="Bonus"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="takeHome"
          label="Take-home"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head
          id="paidOn"
          label="Paid on"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: DistributorSalarySlipRow) => (
          <Table.Row id={row.id}>
            <Table.Cell className="font-medium">{row.periodLabel}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatInr(row.basicSalary)}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatInr(row.performanceIncentive)}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatInr(row.spotBonus)}</Table.Cell>
            <Table.Cell className="text-right tabular-nums font-medium">{formatInr(row.takeHome)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={salaryStatusVariant(row.status)}>
                {getSalaryPaymentStatusLabel(row.status)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
              {formatDistributorDate(row.paidOn)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-job-dashboard-page distributor-payroll-history-page")}>
      <DistributorPageHeader title={title} description="" />

      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-job-metrics distributor-payroll-history-metrics",
        )}
      >
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          tileTone="accent"
          icon={Wallet}
          label="YTD paid"
          value={ytdPaid.display}
          valueTitle={ytdPaid.title}
          hint={`${summary.paidPeriods} periods settled`}
          showTileAction={false}
          fitTileValue
        />
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={Gift}
          label="Avg variable pay"
          value={avgVariablePay.display}
          valueTitle={avgVariablePay.title}
          hint="Performance + bonus"
          showTileAction={false}
          fitTileValue
        />
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={CalendarRange}
          label="Payroll records"
          value={String(summary.totalPeriods)}
          hint={`${summary.waitingPeriods} waiting · ${summary.paidPeriods} paid`}
          showTileAction={false}
        />
      </div>

      <DistributorTableCardShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="No payroll records found"
        emptyDescription="Try adjusting your search or status filter."
        tableSize="sm"
      >
        {table}
      </DistributorTableCardShell>
    </div>
  );
}
