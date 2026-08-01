"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileWarning, Landmark } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorCompliancePageSkeleton } from "@/components/compliance/distributor-compliance-page-skeleton";
import { DistributorComplianceSectionMetrics } from "@/components/compliance/distributor-compliance-section-metrics";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { useDistributorScopePageReveal } from "@/components/dashboard/use-distributor-scope-page-reveal";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE,
  type DistributorComplianceIssueType,
  type DistributorComplianceQueueRow,
} from "@/lib/dummy/distributor-compliance";
import { distributorClientDetailHref } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const ISSUE_TYPE_OPTIONS: Array<{ value: DistributorComplianceIssueType; label: string }> = [
  { value: "KYC pending", label: "KYC pending" },
  { value: "eSign pending", label: "eSign pending" },
  { value: "Bank verification", label: "Bank verification" },
  { value: "Nominee incomplete", label: "Nominee incomplete" },
  { value: "Document expiring", label: "Document expiring" },
  { value: "Compliance exception", label: "Compliance exception" },
];

const PRIORITY_OPTIONS: Array<{ value: DistributorComplianceQueueRow["severity"]; label: string }> = [
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

function severityVariant(severity: DistributorComplianceQueueRow["severity"]): StatusBadgeVariant {
  if (severity === "High") return "destructive";
  if (severity === "Medium") return "warning";
  return "neutral";
}

type DistributorCompliancePanelProps = DistributorPageConfig;

export function DistributorCompliancePanel({ title, description }: DistributorCompliancePanelProps) {
  const { showSkeleton } = useDistributorScopePageReveal();
  const rows = DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE;
  const [searchQuery, setSearchQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState<DistributorComplianceIssueType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<DistributorComplianceQueueRow["severity"] | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "daysOpen",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (issueFilter !== "all" && row.issueType !== issueFilter) return false;
      if (priorityFilter !== "all" && row.severity !== priorityFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        row.clientCode,
        row.clientLabel,
        row.issueType,
        row.stage,
      );
    });
  }, [issueFilter, priorityFilter, rows, searchQuery]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const metrics = <DistributorComplianceSectionMetrics rows={rows} />;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setIssueFilter("all");
        setPriorityFilter("all");
        setPage(1);
      }}
      clearDisabled={issueFilter === "all" && priorityFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search compliance queue…"
          aria-label="Search compliance queue"
        />
      }
    >
      <StatusFilterSelect
        label="Issue type"
        value={issueFilter}
        options={ISSUE_TYPE_OPTIONS}
        onValueChange={(value) => {
          setIssueFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Priority"
        value={priorityFilter}
        options={PRIORITY_OPTIONS}
        onValueChange={(value) => {
          setPriorityFilter(value);
          setPage(1);
        }}
      />
      <DistributorActionButton
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-label="Download compliance queue as Excel"
      >
        <Download className="size-3.5" aria-hidden />
        Excel
      </DistributorActionButton>
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Compliance queue"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="clientCode" label="Client" isRowHeader allowsSorting />
        <Table.Head id="issueType" label="Issue" allowsSorting />
        <Table.Head id="stage" label="Stage" allowsSorting />
        <Table.Head id="severity" label="Priority" allowsSorting />
        <Table.Head id="daysOpen" label="Days open" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head
          id="updatedAt"
          label="Updated"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: DistributorComplianceQueueRow) => (
          <Table.Row id={row.id}>
            <Table.Cell>
              <Link
                href={distributorClientDetailHref("your-book", row.clientId)}
                className="font-medium hover:underline"
              >
                {row.clientLabel}
              </Link>
              <p className="font-mono text-caption text-muted-foreground">{row.clientCode}</p>
            </Table.Cell>
            <Table.Cell>
              <span className="inline-flex items-center gap-1.5">
                {row.issueType === "Bank verification" ? (
                  <Landmark className="size-3.5 text-muted-foreground" aria-hidden />
                ) : row.issueType === "Document expiring" ? (
                  <FileWarning className="size-3.5 text-muted-foreground" aria-hidden />
                ) : null}
                {row.issueType}
              </span>
            </Table.Cell>
            <Table.Cell className="max-w-[14rem] text-muted-foreground">{row.stage}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={severityVariant(row.severity)}>{row.severity}</StatusBadge>
            </Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.daysOpen}</Table.Cell>
            <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
              {formatDistributorDate(row.updatedAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  if (showSkeleton) {
    return <DistributorCompliancePageSkeleton />;
  }

  return (
    <div className={cn("distributor-scope-page--enter", "w-full min-w-0")}>
      <DistributorPageShell
        title={title}
        description={description}
        metrics={metrics}
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="Compliance queue is clear"
        emptyDescription="No clients need action right now."
      >
        {table}
      </DistributorPageShell>
    </div>
  );
}
