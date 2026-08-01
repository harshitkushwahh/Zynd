"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Download } from "lucide-react";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { DistributorReportExportLibrary } from "@/components/reports/distributor-report-export-library";
import { DistributorReportsHeroRow } from "@/components/reports/distributor-reports-hero-row";
import { DistributorReportsPageSkeleton } from "@/components/reports/distributor-reports-page-skeleton";
import { useReportsPageReveal } from "@/components/reports/use-reports-page-reveal";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  DISTRIBUTOR_REPORT_EXPORT_PERIOD_OPTIONS,
  DUMMY_DISTRIBUTOR_REPORT_EXPORTS,
  matchesDistributorReportExportPeriod,
  type DistributorReportExportPeriodFilter,
  type DistributorReportExportRow,
  type DistributorReportFormat,
} from "@/lib/dummy/distributor-reports";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

const EXPORT_FORMAT_OPTIONS: Array<{ value: DistributorReportFormat; label: string }> = [
  { value: "PDF", label: "PDF" },
  { value: "Excel", label: "Excel" },
  { value: "CSV", label: "CSV" },
];

type DistributorReportsPanelProps = DistributorPageConfig;

export function DistributorReportsPanel({ title, description }: DistributorReportsPanelProps) {
  const { showSkeleton } = useReportsPageReveal();
  const [exportSearchQuery, setExportSearchQuery] = useState("");
  const [exportFormatFilter, setExportFormatFilter] = useState<DistributorReportFormat | "all">("all");
  const [exportPeriodFilter, setExportPeriodFilter] = useState<DistributorReportExportPeriodFilter | "all">(
    "all",
  );
  const [exportSortDescriptor, setExportSortDescriptor] = useState<SortDescriptor>({
    column: "generatedAt",
    direction: "descending",
  });

  const filteredExports = useMemo(() => {
    return DUMMY_DISTRIBUTOR_REPORT_EXPORTS.filter((row) => {
      if (exportFormatFilter !== "all" && row.format !== exportFormatFilter) return false;
      if (
        exportPeriodFilter !== "all" &&
        !matchesDistributorReportExportPeriod(row.generatedAt, exportPeriodFilter)
      ) {
        return false;
      }
      return distributorTableSearchMatch(
        exportSearchQuery,
        row.reportName,
        row.format,
        row.periodLabel,
        row.fileSizeLabel,
      );
    });
  }, [exportFormatFilter, exportPeriodFilter, exportSearchQuery]);

  const sortedExports = useMemo(
    () => sortByDescriptor(filteredExports, exportSortDescriptor),
    [exportSortDescriptor, filteredExports],
  );

  const {
    pageItems: exportPageItems,
    pagination: exportPagination,
    setPage: setExportPage,
  } = useDistributorTablePagination(sortedExports);

  const exportsClearDisabled =
    exportFormatFilter === "all" && exportPeriodFilter === "all" && exportSearchQuery.trim() === "";

  const exportsToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setExportSearchQuery("");
        setExportFormatFilter("all");
        setExportPeriodFilter("all");
        setExportPage(1);
      }}
      clearDisabled={exportsClearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={exportSearchQuery}
          onChange={(value) => {
            setExportSearchQuery(value);
            setExportPage(1);
          }}
          placeholder="Search exports…"
          aria-label="Search recent exports"
        />
      }
    >
      <StatusFilterSelect
        label="Period"
        value={exportPeriodFilter}
        options={DISTRIBUTOR_REPORT_EXPORT_PERIOD_OPTIONS}
        onValueChange={(value) => {
          setExportPeriodFilter(value);
          setExportPage(1);
        }}
      />
      <StatusFilterSelect
        label="Format"
        value={exportFormatFilter}
        options={EXPORT_FORMAT_OPTIONS}
        onValueChange={(value) => {
          setExportFormatFilter(value);
          setExportPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const exportsTable = wrapDistributorTableBody(
    <Table
      aria-label="Recent exports"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={exportSortDescriptor}
      onSortChange={(descriptor) => {
        setExportSortDescriptor(descriptor);
        setExportPage(1);
      }}
      pagination={exportPagination}
    >
      <Table.Header>
        <Table.Head id="reportName" label="Report" isRowHeader allowsSorting />
        <Table.Head id="format" label="Format" allowsSorting />
        <Table.Head id="periodLabel" label="Period" allowsSorting />
        <Table.Head
          id="generatedAt"
          label="Generated"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="fileSizeLabel" label="Size" allowsSorting />
        <Table.Head id="actions" label="Actions" className="text-right [&>div]:justify-end" />
      </Table.Header>
      <Table.Body items={exportPageItems}>
        {(row: DistributorReportExportRow) => (
          <Table.Row id={row.id}>
            <Table.Cell className="font-medium">{row.reportName}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant="neutral">{row.format}</StatusBadge>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{row.periodLabel}</Table.Cell>
            <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
              {formatDistributorDate(row.generatedAt)}
            </Table.Cell>
            <Table.Cell className="tabular-nums text-muted-foreground">{row.fileSizeLabel}</Table.Cell>
            <Table.Cell className="text-right">
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Download className="size-3.5" aria-hidden />
                Download
              </Button>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  if (showSkeleton) {
    return <DistributorReportsPageSkeleton />;
  }

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-reports-page distributor-reports-page--enter")}>
      <DistributorPageHeader title={title} description={description} />

      <DistributorReportsHeroRow />

      <DistributorReportExportLibrary />

      <DistributorTableOnlyShell
        toolbar={exportsToolbar}
        isEmpty={sortedExports.length === 0}
        emptyTitle="No exports found"
        emptyDescription="Try adjusting your search, period, or format filter."
        tableSize="sm"
      >
        {exportsTable}
      </DistributorTableOnlyShell>
    </div>
  );
}
