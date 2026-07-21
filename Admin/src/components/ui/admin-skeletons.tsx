"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableSkeletonRows,
} from "@/components/ui/admin-table";
import type { AdminTableMinWidth } from "@/components/ui/admin-design-tokens";

export { AdminTableSkeletonRows } from "@/components/ui/admin-table";

type AdminTableSkeletonRowsProps = {
  columns: number;
  rows?: number;
  dense?: boolean;
};

type AdminTableSkeletonProps = AdminTableSkeletonRowsProps & {
  minWidth?: AdminTableMinWidth;
  headerColumns?: number;
};

export function AdminTableSkeleton({
  columns,
  rows = 6,
  dense,
  minWidth = "default",
  headerColumns,
}: AdminTableSkeletonProps) {
  const headerCount = headerColumns ?? columns;

  return (
    <AdminDataTable minWidth={minWidth}>
      <thead className="border-b border-border bg-muted/30">
        <tr>
          {Array.from({ length: headerCount }).map((_, index) => (
            <th key={`skeleton-head-${index}`} className="px-4 py-3">
              <Skeleton className="h-3 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <AdminTableBody>
        <AdminTableSkeletonRows columns={columns} rows={rows} dense={dense} />
      </AdminTableBody>
    </AdminDataTable>
  );
}

export function AdminBreadcrumbSkeleton({ segments = 2 }: { segments?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-16" />
      {Array.from({ length: segments }).map((_, index) => (
        <div key={`crumb-${index}`} className="flex items-center gap-2">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function AdminPageHeaderSkeleton({ withAside = true }: { withAside?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withAside ? <Skeleton className="size-14 shrink-0 rounded-card" /> : null}
    </div>
  );
}

export function AdminToolbarSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <Skeleton key={`toolbar-action-${index}`} className="h-8 w-24 rounded-control" />
        ))}
      </div>
    </div>
  );
}

export function AdminMetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`metric-skeleton-${index}`}
          className="rounded-card border border-border bg-card p-4"
        >
          <div className="flex gap-3">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-card" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: lines }).map((_, index) => (
            <Skeleton key={`card-line-${index}`} className="h-3 w-full max-w-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminCardListSkeleton({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <AdminCardSkeleton key={`card-list-${index}`} lines={lines} />
      ))}
    </div>
  );
}

export function AdminFormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`form-row-${index}`} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-control" />
        </div>
      ))}
    </div>
  );
}

export function AdminSettingsPanelSkeleton({
  withTable = false,
  tableColumns = 5,
}: {
  withTable?: boolean;
  tableColumns?: number;
}) {
  return (
    <div className="space-y-4">
      <AdminToolbarSkeleton />
      {withTable ? <AdminTableSkeleton columns={tableColumns} rows={5} /> : <AdminFormSkeleton rows={5} />}
    </div>
  );
}

export function AdminProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbSkeleton segments={2} />
      <div className="rounded-card border border-border bg-muted/20 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-4 w-32" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-skeleton-md rounded-card" />
        <Skeleton className="h-skeleton-md rounded-card" />
      </div>
      <Skeleton className="h-skeleton-lg rounded-card" />
    </div>
  );
}

export function AdminDetailDialogSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`dialog-stat-${index}`} className="h-16 rounded-control" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-card" />
      <AdminTableSkeleton columns={4} rows={4} dense />
    </div>
  );
}

export function AdminPageSkeleton({
  withToolbar = false,
  withMetrics = false,
  metricCount = 4,
  withTable = true,
  tableColumns = 6,
}: {
  withToolbar?: boolean;
  withMetrics?: boolean;
  metricCount?: number;
  withTable?: boolean;
  tableColumns?: number;
}) {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbSkeleton />
      <AdminPageHeaderSkeleton />
      {withToolbar ? <AdminToolbarSkeleton /> : null}
      {withMetrics ? <AdminMetricCardsSkeleton count={metricCount} /> : null}
      {withTable ? <AdminTableSkeleton columns={tableColumns} /> : <AdminFormSkeleton />}
    </div>
  );
}

export function AdminConsoleShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <Skeleton className="mx-auto size-12 rounded-card" />
        <Skeleton className="mx-auto h-5 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
      </div>
    </div>
  );
}

export function AdminTabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 border-b border-border pb-2">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={`tab-${index}`} className="h-9 w-28 rounded-control" />
      ))}
    </div>
  );
}
