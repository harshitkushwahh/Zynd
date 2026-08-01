"use client";

import { useMemo, useState } from "react";

import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect } from "@/components/ui/admin-select";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserKycAuditEntry } from "@/lib/admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type AdminUserKycAuditLogPanelProps = {
  entries: AdminUserKycAuditEntry[];
  className?: string;
};

function actorLabel(actor: AdminUserKycAuditEntry["actor"]) {
  return actor === "system" ? "System" : "Investor";
}

function actorVariant(actor: AdminUserKycAuditEntry["actor"]): "info" | "neutral" {
  return actor === "system" ? "info" : "neutral";
}

export function AdminUserKycAuditLogPanel({ entries, className }: AdminUserKycAuditLogPanelProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const actionOptions = useMemo(() => {
    const labels = [...new Set(entries.map((entry) => entry.action))].sort((a, b) =>
      a.localeCompare(b),
    );
    return [{ value: "all", label: "All actions" }, ...labels.map((label) => ({ value: label, label }))];
  }, [entries]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (!normalized) return true;
      return [
        entry.action,
        entry.step_label ?? "",
        entry.detail,
        entry.source,
        actorLabel(entry.actor),
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [actionFilter, entries, search]);

  const pagination = paginateItems(filtered, page, pageSize);
  const pageItems = pagination.items;

  return (
    <section className={cn("admin-user-kyc-audit-log", className)}>
      <div className="admin-user-kyc-audit-log__toolbar">
        <AdminSearchInput
          containerClassName="admin-user-kyc-audit-log__search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search audit log…"
          aria-label="Search audit log"
        />
        <AdminSelect
          aria-label="Filter by action"
          value={actionFilter}
          options={actionOptions}
          onValueChange={(value) => {
            setActionFilter(value);
            setPage(0);
          }}
          triggerClassName="admin-user-kyc-audit-log__filter"
        />
      </div>

      <AdminDataTable
        minWidth="3xl"
        footer={
          filtered.length > 0 ? (
            <AdminTablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              totalCount={filtered.length}
              currentPageCount={pageItems.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              onPrevious={() => setPage((current) => Math.max(0, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          ) : undefined
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="whitespace-nowrap">When</AdminTableHeadCell>
            <AdminTableHeadCell>Action</AdminTableHeadCell>
            <AdminTableHeadCell>Step</AdminTableHeadCell>
            <AdminTableHeadCell>Detail</AdminTableHeadCell>
            <AdminTableHeadCell>Actor</AdminTableHeadCell>
            <AdminTableHeadCell>Source</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {pageItems.length === 0 ? (
            <AdminTableStateRow
              colSpan={6}
              message={
                entries.length === 0
                  ? "No audit events recorded yet."
                  : "No audit events match your filters."
              }
            />
          ) : (
            pageItems.map((entry) => (
              <AdminTableRow key={entry.id}>
                <AdminTableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatTimestampDetail(entry.occurred_at)}
                </AdminTableCell>
                <AdminTableCell className="font-medium text-foreground">{entry.action}</AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {entry.step_label ?? "—"}
                </AdminTableCell>
                <AdminTableCell className="max-w-[22rem] text-muted-foreground">
                  {entry.detail}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={actorVariant(entry.actor)}>
                    {actorLabel(entry.actor)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                  {entry.source}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </section>
  );
}
