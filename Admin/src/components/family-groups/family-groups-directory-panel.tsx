"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, RefreshCw } from "lucide-react";

import { FamilyGroupDetailDialog } from "@/components/family-groups/family-group-detail-dialog";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchAdminFamilyGroups, type AdminFamilyGroupSummary } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type FamilyGroupsDirectoryPanelProps = {
  canManage: boolean;
};

function statusVariant(status: string): "success" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "archived") return "neutral";
  return "info";
}

export function FamilyGroupsDirectoryPanel({ canManage }: FamilyGroupsDirectoryPanelProps) {
  const [items, setItems] = useState<AdminFamilyGroupSummary[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroups({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      setItems(result.items);
      setHasMore(result.items.length === ADMIN_TABLE_PAGE_SIZE);
    } catch (err) {
      setItems([]);
      setHasMore(false);
      setError(getErrorMessage(err, "Could not load family groups."));
    } finally {
      setLoading(false);
    }
  }, [offset, search, status]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  return (
    <div className="space-y-4">
      <AdminSectionTitle description="Browse customer family groups, members, and moderation actions.">
        Group directory
      </AdminSectionTitle>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AdminSearchInput
            containerClassName="max-w-sm"
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
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "all");
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void loadGroups()} aria-label="Refresh">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Group</AdminTableHeadCell>
            <AdminTableHeadCell>Head</AdminTableHeadCell>
            <AdminTableHeadCell>Members</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={6}
            loading={loading}
            isEmpty={items.length === 0}
            emptyMessage="No family groups found."
          >
            {items.map((group) => (
              <AdminTableRow key={group.id}>
                <AdminTableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Row actions">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedGroupId(group.id)}>
                        View details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </AdminTableCell>
                <AdminTableCell>
                  <div>
                    <p className="font-medium text-foreground">{group.title}</p>
                    {group.tag ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{group.tag}</p>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div>
                    <p className="text-compact text-foreground">{group.head_display_name ?? "—"}</p>
                    {group.head_email_masked ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{group.head_email_masked}</p>
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
                    {group.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>{formatTimestampDetail(group.created_at)}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={getOffsetPage(offset)}
        hasPrevious={offset > 0}
        hasNext={hasMore}
        disabled={loading}
        onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))}
        onNext={() => setOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
      />

      <FamilyGroupDetailDialog
        groupId={selectedGroupId}
        open={Boolean(selectedGroupId)}
        canManage={canManage}
        onOpenChange={(open) => {
          if (!open) setSelectedGroupId(null);
        }}
        onUpdated={() => void loadGroups()}
      />
    </div>
  );
}
