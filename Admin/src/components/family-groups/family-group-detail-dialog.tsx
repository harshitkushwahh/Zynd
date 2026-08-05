"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, UserMinus } from "lucide-react";

import { AdminConfirmDialog, AdminDetailDialog } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminDetailDialogSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import {
  adminArchiveFamilyGroup,
  adminRemoveFamilyGroupMember,
  fetchAdminFamilyGroupDetail,
  type AdminFamilyGroupDetail,
} from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";

type FamilyGroupDetailDialogProps = {
  groupId: string | null;
  open: boolean;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

function statusVariant(status: string): "success" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "archived") return "neutral";
  return "info";
}

export function FamilyGroupDetailDialog({
  groupId,
  open,
  canManage,
  onOpenChange,
  onUpdated,
}: FamilyGroupDetailDialogProps) {
  const [detail, setDetail] = useState<AdminFamilyGroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

  const loadDetail = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroupDetail(groupId);
      setDetail(result);
    } catch (err) {
      setDetail(null);
      setError(getErrorMessage(err, "Could not load family group details."));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!open || !groupId) {
      setDetail(null);
      setError("");
      return;
    }
    void loadDetail();
  }, [groupId, loadDetail, open]);

  async function handleArchive() {
    if (!groupId) return;
    setActionLoading("archive");
    setError("");
    try {
      const updated = await adminArchiveFamilyGroup(groupId);
      setDetail(updated);
      setArchiveConfirmOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not archive this group."));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember() {
    if (!groupId || !removeTarget) return;
    setActionLoading(`remove:${removeTarget.userId}`);
    setError("");
    try {
      await adminRemoveFamilyGroupMember(groupId, removeTarget.userId);
      setRemoveTarget(null);
      await loadDetail();
      onUpdated?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove this member."));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <AdminDetailDialog
        open={open}
        onOpenChange={onOpenChange}
        title={detail?.title ?? "Family group"}
        description={detail?.description ?? "Review group metadata, members, invites, and activity."}
      >
        {loading ? <AdminDetailDialogSkeleton /> : null}
        {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

        {detail && !loading ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={statusVariant(detail.status)} showIcon={false}>
                {detail.status}
              </StatusBadge>
              {detail.tag ? (
                <StatusBadge variant="info" showIcon={false}>
                  {detail.tag}
                </StatusBadge>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {detail.member_count} members
                {detail.pending_invite_count > 0 ? ` · ${detail.pending_invite_count} pending invites` : ""}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-muted-foreground">Head</dt>
                <dd className="text-compact font-medium text-foreground">
                  {detail.head_display_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Creator</dt>
                <dd className="text-compact font-medium text-foreground">
                  {detail.creator_display_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Created</dt>
                <dd className="text-compact text-foreground">{formatTimestampDetail(detail.created_at)}</dd>
              </div>
              {detail.archived_at ? (
                <div>
                  <dt className="text-caption text-muted-foreground">Archived</dt>
                  <dd className="text-compact text-foreground">
                    {formatTimestampDetail(detail.archived_at)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {canManage && detail.status === "active" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={actionLoading === "archive"}
                onClick={() => setArchiveConfirmOpen(true)}
              >
                <Archive className="size-4" />
                Force archive
              </Button>
            ) : null}

            <Tabs defaultValue="members" className="gap-3">
              <AdminTabList variant="secondary">
                <AdminTabTrigger value="members">Members</AdminTabTrigger>
                <AdminTabTrigger value="invites">Invites</AdminTabTrigger>
                <AdminTabTrigger value="activity">Activity</AdminTabTrigger>
              </AdminTabList>

              <TabsContent value="members" className="mt-0 space-y-2">
                {detail.members.length === 0 ? (
                  <p className="text-compact text-muted-foreground">No active members.</p>
                ) : (
                  detail.members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-compact font-medium text-foreground">
                          {member.display_nickname ?? member.display_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {member.email_masked} · {member.role}
                          {member.badge_label ? ` · ${member.badge_label}` : ""}
                        </p>
                      </div>
                      {canManage && detail.status === "active" && member.role !== "head" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === `remove:${member.user_id}`}
                          onClick={() =>
                            setRemoveTarget({
                              userId: member.user_id,
                              name: member.display_nickname ?? member.display_name,
                            })
                          }
                        >
                          <UserMinus className="size-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="invites" className="mt-0 space-y-2">
                {detail.invites.length === 0 ? (
                  <p className="text-compact text-muted-foreground">No invites recorded.</p>
                ) : (
                  detail.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-compact font-medium text-foreground">
                          {invite.invitee_email ?? "Unknown invitee"}
                        </p>
                        <StatusBadge variant="info" showIcon={false}>
                          {invite.status}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {invite.intended_role}
                        {invite.intended_badge_label ? ` · ${invite.intended_badge_label}` : ""} · expires{" "}
                        {formatTimestampDetail(invite.expires_at)}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-0 space-y-2">
                {detail.activity.length === 0 ? (
                  <p className="text-compact text-muted-foreground">No activity yet.</p>
                ) : (
                  detail.activity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-border/70 px-3 py-2.5"
                    >
                      <p className="text-compact text-foreground">{item.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatTimestampDetail(item.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </AdminDetailDialog>

      <AdminConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        confirmVariant="destructive"
        title="Force archive this group?"
        description="Members will lose access immediately. This action is intended for support moderation."
        confirmLabel="Archive group"
        loading={actionLoading === "archive"}
        onConfirm={() => void handleArchive()}
      />

      <AdminConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
        confirmVariant="destructive"
        title="Remove member?"
        description={
          removeTarget
            ? `${removeTarget.name} will be removed from this family group immediately.`
            : "This member will be removed from the family group immediately."
        }
        confirmLabel="Remove member"
        loading={Boolean(removeTarget && actionLoading === `remove:${removeTarget.userId}`)}
        onConfirm={() => void handleRemoveMember()}
      />
    </>
  );
}
