"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, LogOut, PencilLine, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveFamilyGroup,
  fetchFamilyGroup,
  leaveFamilyGroup,
  updateFamilyGroup,
  uploadFamilyGroupAvatar,
  revokeFamilyGroupInvite,
  type FamilyGroupDetail,
  type FamilyGroupInvite,
  type FamilyGroupSummary,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupActivityPanel } from "@/features/family-groups/components/family-group-activity-panel";
import { FamilyGroupActivityStrip } from "@/features/family-groups/components/family-group-activity-strip";
import { FamilyGroupHeroSection } from "@/features/family-groups/components/family-group-hero-section";
import { FamilyGroupStatsCard } from "@/features/family-groups/components/family-group-stats-card";
import { FamilyGroupTabs } from "@/features/family-groups/components/family-group-tabs";
import { FamilyGroupInviteDialog } from "@/features/family-groups/components/family-group-invite-dialog";
import { FamilyGroupManageMembersDialog } from "@/features/family-groups/components/family-group-manage-members-dialog";
import { FamilyGroupMembersStrip } from "@/features/family-groups/components/family-group-members-strip";
import { FamilyGroupPortfolioPanel } from "@/features/family-groups/components/family-group-portfolio-panel";
import { FamilyGroupsPageSkeleton } from "@/features/family-groups/components/family-groups-page-skeleton";
import {
  canLeaveGroup,
  leaveGroupBlockedReason,
} from "@/features/family-groups/lib/family-permissions";
import { useAuth } from "@/contexts/auth-context";
import { parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

type FamilyGroupDashboardProps = {
  groupId: string;
  groups: FamilyGroupSummary[];
  onSelectGroup: (groupId: string) => void;
  onCreateGroup?: () => void;
  canCreateGroup?: boolean;
  onMembershipChanged: () => void;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
};

export function FamilyGroupDashboard({
  groupId,
  groups,
  onSelectGroup,
  onCreateGroup,
  canCreateGroup = false,
  onMembershipChanged,
  inviteOpen,
  onInviteOpenChange,
}: FamilyGroupDashboardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [group, setGroup] = useState<FamilyGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showFullActivity, setShowFullActivity] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchFamilyGroup(groupId);
      setGroup(response);
      setTitle(response.title);
      setDescription(response.description ?? "");
      setTag(response.tag ?? "");
      setShowFullActivity(false);
      setSettingsOpen(false);
      setEditing(false);
    } catch (loadError) {
      setError(parseApiError(loadError).message);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const isHead = group?.my_role === "head";
  const memberLimit = group?.member_limit ?? 12;
  const reservedSlots = (group?.member_count ?? 0) + (group?.pending_invite_count ?? 0);
  const canLeave = canLeaveGroup(group?.my_role, group?.member_count ?? 0);
  const leaveBlocked = leaveGroupBlockedReason(group?.my_role, group?.member_count ?? 0);

  async function handleSave() {
    if (!group) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateFamilyGroup(group.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
      });
      setGroup((current) => (current ? { ...current, ...updated } : current));
      setEditing(false);
      onMembershipChanged();
    } catch (submitError) {
      setSaveError(parseApiError(submitError).message || copy.familyGroups.errors.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!group) return;
    setArchiving(true);
    try {
      await archiveFamilyGroup(group.id);
      setArchiveOpen(false);
      onMembershipChanged();
    } catch (archiveError) {
      setSaveError(parseApiError(archiveError).message || copy.familyGroups.errors.archiveFailed);
      setArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  async function handleRevokeInvite(invite: FamilyGroupInvite) {
    if (!group) return;
    try {
      await revokeFamilyGroupInvite(group.id, invite.id);
      await loadGroup();
    } catch (revokeError) {
      setSaveError(parseApiError(revokeError).message || copy.familyGroups.invite.errors.revokeFailed);
    }
  }

  async function handleLeave() {
    if (!group) return;
    setLeaving(true);
    try {
      await leaveFamilyGroup(group.id);
      setLeaveOpen(false);
      onMembershipChanged();
    } catch (leaveError) {
      setSaveError(parseApiError(leaveError).message || copy.familyGroups.governance.errors.leaveFailed);
      setLeaveOpen(false);
    } finally {
      setLeaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !group) return;

    setAvatarUploading(true);
    setSaveError("");
    try {
      const updated = await uploadFamilyGroupAvatar(group.id, file);
      setGroup((current) => (current ? { ...current, ...updated } : current));
      onMembershipChanged();
    } catch (uploadError) {
      setSaveError(parseApiError(uploadError).message || copy.familyGroups.errors.updateFailed);
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  }

  if (loading) {
    return <FamilyGroupsPageSkeleton />;
  }

  if (error) {
    return (
      <LoadErrorCard
        title={copy.familyGroups.errors.pageLoadFailedTitle}
        description={error}
        retryLabel={copy.familyGroups.errors.retry}
        onRetry={() => void loadGroup()}
      />
    );
  }

  if (!group) return null;

  return (
    <>
      <div className="space-y-5">
        <FamilyGroupTabs
          groups={groups}
          selectedGroupId={groupId}
          onSelect={onSelectGroup}
          onCreate={onCreateGroup}
          canCreate={canCreateGroup}
        />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <FamilyGroupHeroSection members={group.members} currentUserId={user?.id} className="min-w-0 flex-1" />
          <FamilyGroupStatsCard
            memberCount={group.member_count}
            pendingInvites={group.pending_invite_count}
            className="w-full xl:w-[20rem] xl:shrink-0"
          />
        </div>

        <FamilyGroupMembersStrip
          members={group.members}
          currentUserId={user?.id}
          canInvite={isHead}
          inviteDisabled={reservedSlots >= memberLimit}
          onInvite={() => onInviteOpenChange(true)}
          onManageMembers={() => setManageMembersOpen(true)}
        />

        <FamilyGroupPortfolioPanel />

        {showFullActivity ? (
          <section className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-body font-semibold text-foreground">{copy.familyGroups.activity.title}</h3>
                <p className="mt-1 text-compact text-muted-foreground">{copy.familyGroups.dashboard.activityTitle}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowFullActivity(false)}>
                {copy.familyGroups.form.cancel}
              </Button>
            </div>
            <FamilyGroupActivityPanel groupId={group.id} />
          </section>
        ) : (
          <FamilyGroupActivityStrip groupId={group.id} onViewAll={() => setShowFullActivity(true)} />
        )}

        {settingsOpen && isHead ? (
          <section className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="relative">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                    {group.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={group.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      <UsersRound className="size-7" strokeWidth={2} />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void handleAvatarChange(event)}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 size-8 rounded-full shadow-zynd-low"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="size-3.5" strokeWidth={2} />
                  </Button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body font-semibold text-foreground">{group.title}</h3>
                    {group.tag ? (
                      <StatusBadge variant="neutral" showIcon={false}>
                        {group.tag}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {group.description ? (
                    <p className="mt-2 max-w-2xl text-compact text-muted-foreground">{group.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing((value) => !value)}>
                  <PencilLine className="size-4" strokeWidth={2} />
                  {copy.familyGroups.detail.editAction}
                </Button>
                <Button type="button" variant="destructive" onClick={() => setArchiveOpen(true)}>
                  {copy.familyGroups.detail.archiveAction}
                </Button>
              </div>
            </div>

            {editing ? (
              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-family-title">{copy.familyGroups.form.titleLabel}</Label>
                  <Input
                    id="edit-family-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-family-description">{copy.familyGroups.form.descriptionLabel}</Label>
                  <Textarea
                    id="edit-family-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-family-tag">{copy.familyGroups.form.tagLabel}</Label>
                  <Input
                    id="edit-family-tag"
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    maxLength={32}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void handleSave()} disabled={saving || !title.trim()}>
                    {copy.familyGroups.form.save}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    {copy.familyGroups.form.cancel}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {canLeave ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setLeaveOpen(true)}>
              <LogOut className="size-4" strokeWidth={2} />
              {copy.familyGroups.detail.leaveAction}
            </Button>
          </div>
        ) : null}
      </div>

      <FamilyGroupManageMembersDialog
        open={manageMembersOpen}
        onOpenChange={setManageMembersOpen}
        group={group}
        currentUserId={user?.id}
        reservedSlots={reservedSlots}
        memberLimit={memberLimit}
        leaveBlocked={leaveBlocked ? copy.familyGroups.detail.leaveBlockedTransferFirst : null}
        saveError={saveError}
        onMemberUpdated={() => {
          void loadGroup();
          onMembershipChanged();
        }}
        onMemberError={setSaveError}
        onRevokeInvite={(invite) => void handleRevokeInvite(invite)}
        onOpenSettings={() => setSettingsOpen(true)}
        isHead={isHead}
      />

      <FamilyGroupInviteDialog
        open={inviteOpen}
        onOpenChange={onInviteOpenChange}
        groupId={groupId}
        groupTitle={group.title}
        memberCount={group.member_count}
        pendingInviteCount={group.pending_invite_count ?? 0}
        memberLimit={memberLimit}
        onInviteCreated={() => {
          void loadGroup();
          onMembershipChanged();
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        variant="destructive"
        title={copy.familyGroups.detail.archiveConfirmTitle}
        description={copy.familyGroups.detail.archiveConfirmDescription}
        confirmLabel={copy.familyGroups.detail.archiveAction}
        loading={archiving}
        onConfirm={() => void handleArchive()}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        variant="destructive"
        title={copy.familyGroups.detail.leaveConfirmTitle}
        description={
          isHead && group.member_count <= 1
            ? copy.familyGroups.detail.leaveSoloHeadDescription
            : copy.familyGroups.detail.leaveConfirmDescription
        }
        confirmLabel={copy.familyGroups.detail.leaveAction}
        loading={leaving}
        onConfirm={() => void handleLeave()}
      />
    </>
  );
}
