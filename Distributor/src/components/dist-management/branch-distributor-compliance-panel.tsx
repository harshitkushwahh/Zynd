"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PenLine, ShieldAlert } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/distributor-branch-distributor-profile-data";
import { getComplianceQueueForBranchDistributor } from "@/lib/distributor-branch-distributor-ops-data";
import {
  getDistributorComplianceSummary,
  type DistributorComplianceIssueType,
  type DistributorComplianceQueueRow,
} from "@/lib/distributor-compliance-data";
import { distributorClientDetailHref } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

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

type BranchDistributorCompliancePanelProps = {
  profile: BranchDistributorProfile;
  className?: string;
};

export function BranchDistributorCompliancePanel({
  profile,
  className,
}: BranchDistributorCompliancePanelProps) {
  const rows = useMemo(
    () => getComplianceQueueForBranchDistributor(profile),
    [profile],
  );
  const summary = useMemo(() => getDistributorComplianceSummary(rows), [rows]);

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

  const clearDisabled =
    issueFilter === "all" && priorityFilter === "all" && searchQuery.trim() === "";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setIssueFilter("all");
        setPriorityFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
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
            <Table.Cell>{row.issueType}</Table.Cell>
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

  return (
    <div className={cn("space-y-4", className)}>
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={ClipboardCheck}
          label="Open items"
          value={String(summary.total)}
          hint="Needs action"
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={ShieldAlert}
          label="KYC pending"
          value={String(summary.kycPending)}
          hint="Incomplete onboarding"
        />
        <BranchDistributorSquareMetricCard
          icon={PenLine}
          label="eSign pending"
          value={String(summary.eSignPending)}
          hint="Awaiting signature"
        />
        <BranchDistributorSquareMetricCard
          icon={AlertTriangle}
          label="High priority"
          value={String(summary.highPriority)}
          hint="Resolve within 48h"
          tone="soft"
        />
      </BranchDistributorSquareCardGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="Compliance queue is clear"
        emptyDescription="No clients need action right now."
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
