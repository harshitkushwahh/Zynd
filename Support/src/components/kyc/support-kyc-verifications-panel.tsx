"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";

import { Table } from "@/components/application/table";
import {
  DISTRIBUTOR_TABLE_PAGE_SIZE,
  DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS,
  type TablePaginationProps,
} from "@/components/application/table/pagination";
import {
  SupportPageMetricTile,
  SupportPageMetricTilesGrid,
} from "@/components/dashboard/support-page-metric-tile";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { SupportMetricsTilesSkeleton, SupportTableSkeleton } from "@/components/dashboard/support-table-skeleton";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { fetchSupportKycQueuePage, type SupportKycQueueMetrics } from "@/lib/support-kyc-queue-api";
import type {
  SupportKycQueueItem,
  SupportKycQueueStatus,
  SupportKycReviewType,
} from "@/lib/support-kyc-queue-dummy-data";
import { supportUserDetailHref } from "@/lib/support-users-api";
import { cn } from "@/lib/utils";

const QUEUE_STATUS_OPTIONS: Array<{ value: SupportKycQueueStatus; label: string }> = [
  { value: "Not started", label: "Not started" },
  { value: "Pending review", label: "Pending review" },
  { value: "In progress", label: "In progress" },
  { value: "Escalated", label: "Escalated" },
  { value: "Approved", label: "Approved" },
];

const REVIEW_TYPE_OPTIONS: Array<{ value: SupportKycReviewType; label: string }> = [
  { value: "Not started", label: "Not started" },
  { value: "Fresh KYC", label: "Fresh KYC" },
  { value: "Re-KYC", label: "Re-KYC" },
  { value: "Document refresh", label: "Document refresh" },
  { value: "Address update", label: "Address update" },
];

const EMPTY_METRICS: SupportKycQueueMetrics = {
  pendingReview: 0,
  inProgress: 0,
  escalated: 0,
  approved: 0,
  notStarted: 0,
  totalInvestors: 0,
};

function queueStatusVariant(status: SupportKycQueueStatus) {
  if (status === "Approved") return "success";
  if (status === "Escalated") return "destructive";
  if (status === "In progress") return "info";
  if (status === "Not started") return "neutral";
  return "warning";
}

function priorityVariant(priority: SupportKycQueueItem["priority"]) {
  return priority === "High" ? "destructive" : "neutral";
}

function supportUserKycHref(clientCode: string) {
  return `${supportUserDetailHref(clientCode)}?tab=kyc`;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SupportKycVerificationsPanel() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [statusFilter, setStatusFilter] = useState<SupportKycQueueStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SupportKycReviewType | "all">("all");
  const [items, setItems] = useState<SupportKycQueueItem[]>([]);
  const [metrics, setMetrics] = useState<SupportKycQueueMetrics>(EMPTY_METRICS);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DISTRIBUTOR_TABLE_PAGE_SIZE);

  const offset = (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter, pageSize]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void fetchSupportKycQueuePage({
      search: debouncedSearch || undefined,
      queueStatus: statusFilter,
      reviewType: typeFilter,
      limit: pageSize,
      offset,
    })
      .then((result) => {
        setItems(result.items);
        if (result.metrics) setMetrics(result.metrics);
        setTotalCount(result.totalCount);
      })
      .catch(() => {
        setItems([]);
        setMetrics(EMPTY_METRICS);
        setTotalCount(0);
        setLoadError("Could not load KYC verifications. Try again in a moment.");
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, typeFilter, pageSize, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pagination = useMemo<TablePaginationProps>(
    () => ({
      page: Math.min(page, totalPages),
      totalPages,
      onPageChange: setPage,
      pageSize,
      pageSizeOptions: DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS,
      onPageSizeChange: (next) => {
        setPageSize(next);
        setPage(1);
      },
      totalItemCount: totalCount,
      alwaysVisible: totalCount > 0,
    }),
    [page, totalPages, pageSize, totalCount],
  );

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
          placeholder="Search by name, email, Zynd ID…"
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
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="displayName" label="Investor" isRowHeader />
        <Table.Head
          id="clientCode"
          label="Zynd ID"
          className={DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS}
        />
        <Table.Head id="reviewType" label="Review type" />
        <Table.Head id="queueStatus" label="Status" />
        <Table.Head id="priority" label="Priority" />
        <Table.Head
          id="submittedAt"
          label="Submitted"
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={items}>
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
            <Table.Cell>
              <div className="min-w-0">
                <p className="truncate text-muted-foreground">{row.reviewType}</p>
                {row.partnerStatus ? (
                  <p className="truncate text-caption text-muted-foreground/80">
                    Cybrilla: {row.partnerStatus}
                  </p>
                ) : row.cybrillaFormType ? (
                  <p className="truncate text-caption text-muted-foreground/80">
                    Form: {row.cybrillaFormType}
                  </p>
                ) : null}
              </div>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={queueStatusVariant(row.queueStatus)}>{row.queueStatus}</StatusBadge>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={priorityVariant(row.priority)} showIcon={false}>
                {row.priority}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}>
              {row.submittedAt && row.submittedAt !== new Date(0).toISOString()
                ? formatDistributorDate(row.submittedAt)
                : ""}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="KYC & Verifications" />

      {loading && items.length === 0 ? (
        <SupportMetricsTilesSkeleton />
      ) : (
        <SupportPageMetricTilesGrid>
          <SupportPageMetricTile
            tileTone="accent"
            icon={ClipboardCheck}
            label="Not started"
            value={String(metrics.notStarted)}
          />
          <SupportPageMetricTile icon={Clock3} label="In progress" value={String(metrics.inProgress)} />
          <SupportPageMetricTile
            icon={AlertTriangle}
            label="Escalated"
            value={String(metrics.escalated)}
          />
          <SupportPageMetricTile
            tileTone="success"
            icon={CheckCircle2}
            label="Approved"
            value={String(metrics.approved)}
          />
        </SupportPageMetricTilesGrid>
      )}

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isLoading={loading}
        loadingSkeleton={<SupportTableSkeleton rowCount={10} columnCount={6} />}
        isEmpty={!loading && items.length === 0}
        emptyTitle={loadError || "No KYC cases match your filters"}
        emptyDescription={
          loadError ? undefined : DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription
        }
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
