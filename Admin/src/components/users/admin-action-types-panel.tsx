"use client";

import { useEffect, useMemo, useState } from "react";

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
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { ADMIN_ACTION_TYPES } from "@/lib/admin-action-types-meta";

export function AdminActionTypesPanel() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ADMIN_ACTION_TYPES;
    return ADMIN_ACTION_TYPES.filter(
      (item) =>
        item.key.toLowerCase().includes(normalized) ||
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.requestPermission.toLowerCase().includes(normalized) ||
        item.approvePermission.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [query, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="space-y-4">
      <AdminSearchInput
        containerClassName="max-w-sm"
        placeholder="Search action types"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <AdminDataTable
        minWidth="md"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            totalCount={filtered.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Action</AdminTableHeadCell>
            <AdminTableHeadCell>Description</AdminTableHeadCell>
            <AdminTableHeadCell>Flow</AdminTableHeadCell>
            <AdminTableHeadCell>Permissions</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {filtered.length === 0 ? (
            <AdminTableStateRow colSpan={4}>No action types match your search.</AdminTableStateRow>
          ) : (
            pagination.items.map((item) => (
              <AdminTableRow key={item.key}>
                <AdminTableCell>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">{item.key}</p>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{item.description}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={item.makerChecker ? "info" : "neutral"} showIcon={false}>
                    {item.makerChecker ? "Maker-checker" : "Direct"}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>
                  <p className="text-compact text-foreground">{item.requestPermission}</p>
                  <p className="mt-1 text-caption text-muted-foreground">{item.approvePermission}</p>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
