"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { SendAdminInvitationDialog } from "@/components/users/send-admin-invitation-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSettingsPanelSkeleton } from "@/components/ui/admin-skeletons";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createAdminInvitation,
  fetchAdminInvitations,
  resendAdminInvitation,
  revokeAdminInvitation,
  fetchAdminRoles,
  type AdminInvitation,
  type AdminRole,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";


function invitationStatusVariant(status: AdminInvitation["status"]) {
  if (status === "pending") return "warning" as const;
  if (status === "accepted") return "success" as const;
  if (status === "revoked") return "neutral" as const;
  return "destructive" as const;
}

function formatInviteName(invitation: AdminInvitation) {
  const parts = [invitation.first_name, invitation.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export function AdminInvitationsSettingsPanel() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const pendingCount = useMemo(
    () => invitations.filter((item) => item.status === "pending").length,
    [invitations],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextRoles, nextInvitations] = await Promise.all([
        fetchAdminRoles(),
        fetchAdminInvitations(),
      ]);
      setRoles(nextRoles);
      setInvitations(nextInvitations);
    } catch (err) {
      setRoles([]);
      setInvitations([]);
      setError(getErrorMessage(err, "Could not load invitations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSendInvitation = async (payload: {
    email: string;
    first_name?: string;
    last_name?: string;
    role_key: string;
  }) => {
    setActionLoading("create");
    setDialogError("");
    try {
      const invitation = await createAdminInvitation(payload);
      setDialogOpen(false);
      setMessage(`Invitation sent to ${invitation.email}.`);
      await loadData();
    } catch (err) {
      setDialogError(getErrorMessage(err, "Could not send invitation."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (invitation: AdminInvitation) => {
    setActionLoading(invitation.id);
    setError("");
    setMessage("");
    try {
      await revokeAdminInvitation(invitation.id);
      setMessage(`Revoked invitation for ${invitation.email}.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not revoke invitation."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitation: AdminInvitation) => {
    setActionLoading(invitation.id);
    setError("");
    setMessage("");
    try {
      await resendAdminInvitation(invitation.id);
      setMessage(`Resent invitation to ${invitation.email}.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not resend invitation."));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <AdminSettingsPanelSkeleton withTable tableColumns={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-compact font-medium text-foreground">
            {pendingCount} pending invitation{pendingCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadData()} aria-label="Refresh">
            <RefreshCw className="size-3.5" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="size-3.5" />
            Send invitation
          </Button>
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="default">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
            <AdminTableHeadCell>Invitee</AdminTableHeadCell>
            <AdminTableHeadCell>Role</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Sent by</AdminTableHeadCell>
            <AdminTableHeadCell>Expires</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {invitations.length === 0 ? (
            <AdminTableStateRow colSpan={6}>
              No invitations yet. Send one to onboard a new admin.
            </AdminTableStateRow>
          ) : (
            invitations.map((invitation) => (
              <AdminTableRow key={invitation.id}>
                <AdminTableCell className="text-right">
                  {invitation.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === invitation.id}
                        onClick={() => void handleResend(invitation)}
                      >
                        <Mail className="size-3.5" />
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === invitation.id}
                        onClick={() => void handleRevoke(invitation)}
                      >
                        <XCircle className="size-3.5" />
                        Revoke
                      </Button>
                    </div>
                  ) : (
                    <span className="text-caption text-muted-foreground">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="min-w-0">
                    <p className="truncate text-compact font-medium text-foreground">
                      {invitation.email}
                    </p>
                    <p className="truncate text-caption text-muted-foreground">
                      {formatInviteName(invitation)}
                    </p>
                  </div>
                </AdminTableCell>
                <AdminTableCell>{invitation.role_name ?? invitation.role_key}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={invitationStatusVariant(invitation.status)}>
                    {invitation.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>{invitation.inviter_name ?? "—"}</AdminTableCell>
                <AdminTableCell>
                  {new Date(invitation.expires_at).toLocaleString()}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <SendAdminInvitationDialog
        open={dialogOpen}
        roles={roles}
        saving={actionLoading === "create"}
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError("");
        }}
        onSend={(payload) => void handleSendInvitation(payload)}
      />
    </div>
  );
}
