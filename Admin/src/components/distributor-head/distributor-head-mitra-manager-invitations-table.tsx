"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, XCircle } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchAdminHierarchyMitraManagerInvitations,
  resendAdminHierarchyMitraManagerInvitation,
  revokeAdminHierarchyMitraManagerInvitation,
  type AdminHierarchyMitraManagerInvitation,
} from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadMitraManagerInvitationsTableProps = {
  refreshKey?: number;
};

function invitationStatusVariant(
  status: AdminHierarchyMitraManagerInvitation["status"],
): StatusBadgeVariant {
  if (status === "pending") return "warning";
  if (status === "accepted") return "success";
  if (status === "revoked") return "neutral";
  return "destructive";
}

function formatInviteName(invitation: AdminHierarchyMitraManagerInvitation) {
  const parts = [invitation.first_name, invitation.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export function DistributorHeadMitraManagerInvitationsTable({
  refreshKey = 0,
}: DistributorHeadMitraManagerInvitationsTableProps) {
  const [items, setItems] = useState<AdminHierarchyMitraManagerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await fetchAdminHierarchyMitraManagerInvitations();
      setItems(nextItems);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err, "Could not load invitations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleRevoke = async (invitation: AdminHierarchyMitraManagerInvitation) => {
    setActionLoading(invitation.id);
    setError("");
    try {
      await revokeAdminHierarchyMitraManagerInvitation(invitation.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not revoke invitation."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitation: AdminHierarchyMitraManagerInvitation) => {
    setActionLoading(invitation.id);
    setError("");
    try {
      await resendAdminHierarchyMitraManagerInvitation(invitation.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not resend invitation."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="5xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Email</AdminTableHeadCell>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Sent by</AdminTableHeadCell>
            <AdminTableHeadCell>Sent</AdminTableHeadCell>
            <AdminTableHeadCell>Expires</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableStateRow colSpan={7}>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading invitations…
              </span>
            </AdminTableStateRow>
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={7}>
              No {MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()} invitations yet.
            </AdminTableStateRow>
          ) : (
            items.map((invitation) => (
              <AdminTableRow key={invitation.id}>
                <AdminTableCell className="text-right">
                  {invitation.status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={actionLoading === invitation.id}
                              aria-label="Resend invitation"
                              onClick={() => void handleResend(invitation)}
                            >
                              <Mail className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent side="top">Resend</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={actionLoading === invitation.id}
                              aria-label="Revoke invitation"
                              onClick={() => void handleRevoke(invitation)}
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          }
                        />
                        <TooltipContent side="top">Revoke</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className="text-caption text-muted-foreground">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>{invitation.email}</AdminTableCell>
                <AdminTableCell>{formatInviteName(invitation)}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={invitationStatusVariant(invitation.status)}>
                    {invitation.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>{invitation.inviter_name ?? "—"}</AdminTableCell>
                <AdminTableCell>{new Date(invitation.created_at).toLocaleString()}</AdminTableCell>
                <AdminTableCell>{new Date(invitation.expires_at).toLocaleString()}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
