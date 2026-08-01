"use client";

import { useMemo, useState } from "react";
import { Building2, Clock3, Home, Info, MapPin } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableCardShell } from "@/components/dashboard/distributor-table-card-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import {
  attendanceStatusLabel,
  formatClockTime,
  WORK_TYPE_OPTIONS,
  workTypeVariant,
} from "@/components/payouts/distributor-work-attendance-shared";
import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
  getDistributorWorkAttendanceSummary,
  type DistributorWorkAttendanceRow,
  type DistributorWorkLocationType,
} from "@/lib/dummy/distributor-job-dashboard";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
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

type DistributorWorkAttendanceDetailPanelProps = DistributorPageConfig;

export function DistributorWorkAttendanceDetailPanel({ title }: DistributorWorkAttendanceDetailPanelProps) {
  const rows = DUMMY_DISTRIBUTOR_WORK_ATTENDANCE;
  const summary = useMemo(() => getDistributorWorkAttendanceSummary(rows), [rows]);
  const [searchQuery, setSearchQuery] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState<DistributorWorkLocationType | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (workTypeFilter !== "all" && row.workType !== workTypeFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        formatDistributorDate(row.date),
        row.workType ?? "",
        attendanceStatusLabel(row) ?? "",
      );
    });
  }, [rows, searchQuery, workTypeFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setWorkTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={workTypeFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search attendance…"
          aria-label="Search attendance records"
        />
      }
    >
      <StatusFilterSelect
        label="Work type"
        value={workTypeFilter}
        options={WORK_TYPE_OPTIONS}
        onValueChange={(value) => {
          setWorkTypeFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      key="job-work-attendance-detail"
      aria-label="Work attendance"
      className="min-w-[var(--table-min-width-2xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="date" label="Date" isRowHeader allowsSorting />
        <Table.Head id="clockIn" label="Clock in" allowsSorting />
        <Table.Head id="clockOut" label="Clock out" allowsSorting />
        <Table.Head
          id="hours"
          label="Hours"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="workType" label="Work type" allowsSorting />
        <Table.Head
          id="payFactor"
          label="Pay factor"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: DistributorWorkAttendanceRow) => {
          const statusLabel = attendanceStatusLabel(row);
          return (
            <Table.Row id={row.id}>
              <Table.Cell>
                <p className="font-medium">{formatDistributorDate(row.date)}</p>
                {statusLabel ? (
                  <p className="text-caption text-muted-foreground">{statusLabel}</p>
                ) : null}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted-foreground">
                {formatClockTime(row.clockIn)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted-foreground">
                {formatClockTime(row.clockOut)}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {row.hours > 0 ? `${row.hours.toFixed(1)}h` : "—"}
              </Table.Cell>
              <Table.Cell>
                {row.workType ? (
                  <StatusBadge variant={workTypeVariant(row.workType)}>
                    {row.workType}
                  </StatusBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {row.payFactor > 0 ? `${row.payFactor.toFixed(2)}×` : "—"}
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        "distributor-job-dashboard-page distributor-work-attendance-detail-page",
      )}
    >
      <DistributorPageHeader title={title} description="" />

      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-job-metrics distributor-work-attendance-history-metrics",
        )}
      >
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          tileTone="accent"
          icon={Clock3}
          label="Hours logged"
          value={`${summary.totalHours}h`}
          hint={`${summary.weightedHours}h weighted for payroll`}
          showTileAction={false}
        />
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={Building2}
          label="Office days"
          value={String(summary.officeDays)}
          hint={`${summary.loggedDays} days with entries`}
          showTileAction={false}
        />
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={MapPin}
          label="Client site"
          value={String(summary.clientSiteDays)}
          hint="1.15× field allowance factor"
          showTileAction={false}
        />
        <DistributorMetricCard
          className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
          variant="tile"
          icon={Home}
          label="Work from home"
          value={String(summary.homeDays)}
          hint="0.95× remote day factor"
          showTileAction={false}
        />
      </div>

      <DistributorTableCardShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="No attendance records found"
        emptyDescription="Try adjusting your search or work type filter."
        tableSize="sm"
      >
        {table}
      </DistributorTableCardShell>

      <p className="distributor-job-work-attendance__footnote">
        <Info className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
        <span>
          {DUMMY_DISTRIBUTOR_JOB_COMPENSATION.periodLabel} payroll uses weighted hours (logged hours × pay
          factor). Client site days include travel allowance; home days apply a reduced factor.
        </span>
      </p>
    </div>
  );
}
