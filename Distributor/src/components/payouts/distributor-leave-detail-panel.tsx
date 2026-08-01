"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { CalendarRange, Palmtree, Plus, Stethoscope, Sun } from "lucide-react";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorApplyLeaveDialog } from "@/components/payouts/distributor-apply-leave-dialog";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableCardShell } from "@/components/dashboard/distributor-table-card-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
  DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
  LEAVE_REQUEST_STATUS_OPTIONS,
  LEAVE_TYPE_OPTIONS,
  getLeaveRequestStatusLabel,
  type DistributorLeaveRequest,
  type DistributorLeaveRequestStatus,
  type DistributorLeaveType,
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
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

type DistributorLeaveDetailPanelProps = DistributorPageConfig;

function leaveStatusVariant(status: DistributorLeaveRequestStatus): StatusBadgeVariant {
  if (status === "Approved") return "success";
  if (status === "Pending") return "warning";
  return "destructive";
}

function formatLeaveDates(request: DistributorLeaveRequest): string {
  const from = formatDistributorDate(request.fromDate);
  if (request.fromDate === request.toDate) return from;
  return `${from} – ${formatDistributorDate(request.toDate)}`;
}

function leaveTypeIcon(type: DistributorLeaveType) {
  if (type === "Annual") return Palmtree;
  if (type === "Sick") return Stethoscope;
  if (type === "Casual") return Sun;
  return null;
}

const LEAVE_BALANCE_ICONS: Record<string, typeof Palmtree> = {
  Annual: Palmtree,
  Sick: Stethoscope,
  Casual: Sun,
};

export function DistributorLeaveDetailPanel({ title }: DistributorLeaveDetailPanelProps) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DistributorLeaveRequestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<DistributorLeaveType | "all">("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "appliedAt", direction: "descending" });

  const balances = DUMMY_DISTRIBUTOR_LEAVE_BALANCES;
  const rows = DUMMY_DISTRIBUTOR_LEAVE_REQUESTS;

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!query) return true;
      return distributorTableSearchMatch(
        query,
        row.type,
        row.reason,
        row.status,
        getLeaveRequestStatusLabel(row.status),
        formatLeaveDates(row),
      );
    });
  }, [rows, searchQuery, statusFilter, typeFilter]);

  const sortedRows = useMemo(
    () => sortByDescriptor(filteredRows, sort),
    [filteredRows, sort],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sortedRows);

  const summary = useMemo(() => {
    const approved = rows.filter((row) => row.status === "Approved").length;
    const pending = rows.filter((row) => row.status === "Pending").length;
    const declined = rows.filter((row) => row.status === "Rejected").length;
    const daysTaken = rows
      .filter((row) => row.status === "Approved")
      .reduce((total, row) => total + row.days, 0);
    return { approved, pending, declined, daysTaken };
  }, [rows]);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={statusFilter === "all" && typeFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search leave history…"
          aria-label="Search leave history"
        />
      }
    >
      <StatusFilterSelect
        label="Type"
        value={typeFilter}
        options={LEAVE_TYPE_OPTIONS}
        onValueChange={(value) => {
          setTypeFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={LEAVE_REQUEST_STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Leave history"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sort}
      onSortChange={(descriptor) => {
        setSort(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="type" label="Type" isRowHeader allowsSorting />
        <Table.Head id="days" label="Days" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="fromDate" label="Dates" allowsSorting />
        <Table.Head id="reason" label="Reason" allowsSorting />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head
          id="appliedAt"
          label="Applied"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head
          id="reviewedAt"
          label="Reviewed"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: DistributorLeaveRequest) => {
          const TypeIcon = leaveTypeIcon(row.type);
          return (
            <Table.Row id={row.id}>
              <Table.Cell className="font-medium">
                <span className="distributor-leave-detail__type-cell">
                  {TypeIcon ? (
                    <span className="distributor-leave-detail__type-icon" aria-hidden>
                      <TypeIcon className="size-3.5" strokeWidth={2.25} />
                    </span>
                  ) : null}
                  {row.type}
                </span>
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">{row.days}</Table.Cell>
              <Table.Cell className="text-muted-foreground">{formatLeaveDates(row)}</Table.Cell>
              <Table.Cell>
                <span className="distributor-leave-detail__reason" title={row.reason}>
                  {row.reason}
                </span>
                {row.reviewNote ? (
                  <span className="distributor-leave-detail__review-note" title={row.reviewNote}>
                    {row.reviewNote}
                  </span>
                ) : null}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={leaveStatusVariant(row.status)}>
                  {getLeaveRequestStatusLabel(row.status)}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
                {formatDistributorDate(row.appliedAt)}
              </Table.Cell>
              <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
                {row.reviewedAt ? formatDistributorDate(row.reviewedAt) : "—"}
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-job-dashboard-page distributor-leave-detail-page")}>
      <div className="distributor-leave-detail__header">
        <DistributorPageHeader title={title} description="" />
        <DistributorActionButton
          type="button"
          variant="primary"
          size="sm"
          className="gap-1.5"
          onClick={() => setLeaveDialogOpen(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Apply leave
        </DistributorActionButton>
      </div>

      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-job-metrics distributor-leave-history-metrics",
        )}
      >
        {balances.map((balance, index) => {
          const Icon = LEAVE_BALANCE_ICONS[balance.type] ?? Palmtree;
          return (
            <DistributorMetricCard
              key={balance.type}
              className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
              variant="tile"
              tileTone={index === 0 ? "accent" : "default"}
              icon={Icon}
              label={balance.type}
              value={`${balance.remaining} left`}
              hint={`${balance.used} used · ${balance.total} total`}
              showTileAction={false}
            />
          );
        })}
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={CalendarRange}
          label="This year"
          value={`${summary.daysTaken} days taken`}
          hint={`${summary.approved} approved · ${summary.pending} pending · ${summary.declined} declined`}
          showTileAction={false}
          fitTileValue
        />
      </div>

      <DistributorTableCardShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="No leave requests found"
        emptyDescription="Try adjusting your search or filters."
        tableSize="sm"
      >
        {table}
      </DistributorTableCardShell>

      <DistributorApplyLeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        balances={balances}
      />
    </div>
  );
}
