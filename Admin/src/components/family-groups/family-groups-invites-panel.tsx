"use client";

import { useCallback, useEffect, useState } from "react";
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
import { FamilyGroupInviteJourneyDialog } from "@/components/family-groups/family-group-invite-journey-dialog";
import { fetchAdminFamilyGroupInvites, type AdminFamilyGroupInvite } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
];

function inviteVariant(status: string): "warning" | "success" | "neutral" | "info" {
  if (status === "pending") return "warning";
  if (status === "accepted") return "success";
  if (status === "declined" || status === "revoked" || status === "expired") return "neutral";
  return "info";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function FamilyGroupsInvitesPanel() {
  const [items, setItems] = useState<AdminFamilyGroupInvite[]>([]);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedInvite, setSelectedInvite] = useState<AdminFamilyGroupInvite | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroupInvites({
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
      setError(getErrorMessage(err, "Could not load family group invites."));
    } finally {
      setLoading(false);
    }
  }, [offset, pageSize, search, status]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
          placeholder="Search group or invitee email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setOffset(0);
              void loadInvites();
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
          <Button type="button" variant="outline" size="icon" onClick={() => void loadInvites()} aria-label="Refresh">
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
            <AdminTableHeadCell>Invitee</AdminTableHeadCell>
            <AdminTableHeadCell>Role</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Expires</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={5}
            loading={loading}
            isEmpty={items.length === 0}
            emptyMessage="No invites found."
          >
            {items.map((invite) => (
              <AdminTableRow key={invite.id} onClick={() => setSelectedInvite(invite)}>
                <AdminTableCell>
                  <div>
                    <p className="font-medium text-foreground">{invite.group_title ?? "—"}</p>
                    {invite.group_status ? (
                      <p className="mt-0.5 text-caption capitalize text-muted-foreground">
                        {statusLabel(invite.group_status)}
                      </p>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell>{invite.invitee_email ?? "—"}</AdminTableCell>
                <AdminTableCell>
                  {statusLabel(invite.intended_role)}
                  {invite.intended_badge_label ? ` · ${invite.intended_badge_label}` : ""}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={inviteVariant(invite.status)} showIcon={false}>
                    {statusLabel(invite.status)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestampDetail(invite.expires_at)}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>

      <FamilyGroupInviteJourneyDialog
        open={Boolean(selectedInvite)}
        inviteId={selectedInvite?.id ?? null}
        initialInvite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
      />
    </div>
  );
}
