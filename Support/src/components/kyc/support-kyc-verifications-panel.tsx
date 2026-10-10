"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import {
  SupportPageMetricTile,
  SupportPageMetricTilesGrid,
} from "@/components/dashboard/support-page-metric-tile";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import {
  SUPPORT_DUMMY_KYC_QUEUE,
  type SupportKycQueueItem,
  type SupportKycQueueStatus,
  type SupportKycReviewType,
} from "@/lib/support-kyc-queue-dummy-data";
import { cn } from "@/lib/utils";

const QUEUE_STATUS_OPTIONS: Array<{ value: SupportKycQueueStatus; label: string }> = [
  { value: "Pending review", label: "Pending review" },
  { value: "In progress", label: "In progress" },
  { value: "Escalated", label: "Escalated" },
  { value: "Approved", label: "Approved" },
];

const REVIEW_TYPE_OPTIONS: Array<{ value: SupportKycReviewType; label: string }> = [
  { value: "New KYC", label: "New KYC" },
  { value: "Re-KYC", label: "Re-KYC" },
  { value: "Document refresh", label: "Document refresh" },
  { value: "Address update", label: "Address update" },
];

function queueStatusVariant(status: SupportKycQueueStatus) {
  if (status === "Approved") return "success";
  if (status === "Escalated") return "destructive";
  if (status === "In progress") return "info";
  return "warning";
}

function priorityVariant(priority: SupportKycQueueItem["priority"]) {
  return priority === "High" ? "destructive" : "neutral";
}

function supportUserKycHref(clientCode: string) {
  return `/dashboard/users/${encodeURIComponent(clientCode)}?tab=kyc`;
}

export function SupportKycVerificationsPanel() {
  const router = useRouter();
  const items = SUPPORT_DUMMY_KYC_QUEUE;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupportKycQueueStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SupportKycReviewType | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "submittedAt",
    direction: "descending",
  });

  const pendingCount = items.filter((row) => row.queueStatus === "Pending review").length;
  const inProgressCount = items.filter((row) => row.queueStatus === "In progress").length;
  const escalatedCount = items.filter((row) => row.queueStatus === "Escalated").length;
  const approvedCount = items.filter((row) => row.queueStatus === "Approved").length;

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (statusFilter !== "all" && row.queueStatus !== statusFilter) return false;
      if (typeFilter !== "all" && row.reviewType !== typeFilter) return false;
      return distributorTableSearchMatch(
        search,
        row.clientCode,
        row.displayName,
        row.emailMasked,
        row.reviewType,
        row.queueStatus,
      );
    });
  }, [items, search, statusFilter, typeFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled =
    statusFilter === "all" && typeFilter === "all" && search.trim() === "";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setStatusFilter("all");
        setTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search KYC queue…"
          aria-label="Search KYC queue"
        />
      }
    >
      <SupportFilterSelect
        label="Status"
        value={statusFilter}
        options={QUEUE_STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
      <SupportFilterSelect
        label="Review type"
        value={typeFilter}
        options={REVIEW_TYPE_OPTIONS}
        onValueChange={(value) => {
          setTypeFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="KYC verification queue"
      className="min-w-[var(--table-min-width-5xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="displayName" label="Investor" isRowHeader allowsSorting />
        <Table.Head
          id="clientCode"
          label="Zynd ID"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS}
        />
        <Table.Head id="reviewType" label="Review type" allowsSorting />
        <Table.Head id="queueStatus" label="Status" allowsSorting />
        <Table.Head id="priority" label="Priority" allowsSorting />
        <Table.Head
          id="submittedAt"
          label="Submitted"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row) => (
          <Table.Row
            id={row.id}
            className="cursor-pointer"
            onAction={() => router.push(supportUserKycHref(row.clientCode))}
          >
            <Table.Cell>
              <div className="min-w-0">
                <p className="truncate text-compact font-medium text-foreground">{row.displayName}</p>
                <p className="truncate text-caption text-muted-foreground">{row.emailMasked}</p>
              </div>
            </Table.Cell>
            <Table.Cell className={cn("font-mono text-caption", DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS)}>
              {row.clientCode}
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{row.reviewType}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={queueStatusVariant(row.queueStatus)}>{row.queueStatus}</StatusBadge>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={priorityVariant(row.priority)} showIcon={false}>
                {row.priority}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}>
              {formatDistributorDate(row.submittedAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="KYC & Verifications" />

      <SupportPageMetricTilesGrid>
        <SupportPageMetricTile
          tileTone="accent"
          icon={ClipboardCheck}
          label="Pending review"
          value={String(pendingCount)}
        />
        <SupportPageMetricTile
          icon={Clock3}
          label="In progress"
          value={String(inProgressCount)}
        />
        <SupportPageMetricTile
          icon={AlertTriangle}
          label="Escalated"
          value={String(escalatedCount)}
        />
        <SupportPageMetricTile
          tileTone="success"
          icon={CheckCircle2}
          label="Approved"
          value={String(approvedCount)}
        />
      </SupportPageMetricTilesGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No KYC cases match your filters"
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
