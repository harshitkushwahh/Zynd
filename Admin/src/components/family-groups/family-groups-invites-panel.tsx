"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchAdminFamilyGroupInvites, type AdminFamilyGroupInvite } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const INVITE_STATUSES = ["pending", "accepted", "declined", "revoked", "expired"];

function inviteVariant(status: string): "warning" | "success" | "neutral" | "info" {
  if (status === "pending") return "warning";
  if (status === "accepted") return "success";
  if (status === "declined" || status === "revoked" || status === "expired") return "neutral";
  return "info";
}

export function FamilyGroupsInvitesPanel() {
  const [items, setItems] = useState<AdminFamilyGroupInvite[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroupInvites({
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
      setError(getErrorMessage(err, "Could not load family group invites."));
    } finally {
      setLoading(false);
    }
  }, [offset, search, status]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  return (
    <div className="space-y-4">
      <AdminSectionTitle description="Pending and historical invites across all family groups.">
        Cross-group invites
      </AdminSectionTitle>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AdminSearchInput
            containerClassName="max-w-sm"
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
              {INVITE_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void loadInvites()} aria-label="Refresh">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="lg">
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
              <AdminTableRow key={invite.id}>
                <AdminTableCell>
                  <div>
                    <p className="font-medium text-foreground">{invite.group_title ?? "—"}</p>
                    {invite.group_status ? (
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{invite.group_status}</p>
                    ) : null}
                  </div>
                </AdminTableCell>
                <AdminTableCell>{invite.invitee_email ?? "—"}</AdminTableCell>
                <AdminTableCell>
                  {invite.intended_role}
                  {invite.intended_badge_label ? ` · ${invite.intended_badge_label}` : ""}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={inviteVariant(invite.status)} showIcon={false}>
                    {invite.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>{formatTimestampDetail(invite.expires_at)}</AdminTableCell>
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
    </div>
  );
}
