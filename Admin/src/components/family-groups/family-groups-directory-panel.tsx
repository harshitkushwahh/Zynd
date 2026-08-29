"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
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
  AdminTableRows,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { familyGroupsGroupHref } from "@/lib/admin-family-groups-navigation";
import { fetchAdminFamilyGroups, type AdminFamilyGroupSummary } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

function statusVariant(status: string): "success" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "archived") return "neutral";
  return "info";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function FamilyGroupsDirectoryPanel() {
  const router = useRouter();
  const [items, setItems] = useState<AdminFamilyGroupSummary[]>([]);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroups({
        status: status === ALL ? undefined : status,
        search: search.trim() || undefined,
        limit: pageSize,
        offset,
      });
      setItems(result.items);
      setHasMore(result.items.length === pageSize);
    } catch (err) {
      setItems([]);
      setHasMore(false);
      setError(getErrorMessage(err, "Could not load family groups."));
    } finally {
      setLoading(false);
    }
  }, [offset, pageSize, search, status]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
          placeholder="Search by group name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setOffset(0);
              void loadGroups();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AdminSelect
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setOffset(0);
            }}
            options={STATUS_OPTIONS}
            aria-label="Filter by status"
            className="min-w-select-sm"
            triggerClassName="w-auto"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => void loadGroups()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="2xl"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={loading}
            currentPageCount={items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOffset(0);
            }}
            onPrevious={() => setOffset((current) => Math.max(0, current - pageSize))}
            onNext={() => setOffset((current) => current + pageSize)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Group</AdminTableHeadCell>
            <AdminTableHeadCell>Head</AdminTableHeadCell>
            <AdminTableHeadCell>Members</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={5}
            loading={loading}
            isEmpty={items.length === 0}
            emptyMessage="No family groups found."
          >
            {items.map((group) => (
              <AdminTableRow key={group.id} onClick={() => router.push(familyGroupsGroupHref(group.id))}>
                <AdminTableCell>
                  <div>
                    <p className="font-medium text-foreground">{group.title}</p>
                    {group.tag ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">{group.tag}</p>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div>
                    <p className="text-foreground">{group.head_display_name ?? "—"}</p>
                    {group.head_email_masked ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">{group.head_email_masked}</p>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  {group.member_count}
                  {group.pending_invite_count > 0 ? (
                    <span className="text-muted-foreground"> · {group.pending_invite_count} pending</span>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={statusVariant(group.status)} showIcon={false}>
                    {statusLabel(group.status)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestampDetail(group.created_at)}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
