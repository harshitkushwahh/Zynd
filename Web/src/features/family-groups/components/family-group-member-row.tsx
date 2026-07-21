"use client";

import { useEffect, useState } from "react";
import { Crown, Trash2, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchFamilyGroupBadges,
  removeFamilyGroupMember,
  transferFamilyGroupHead,
  updateFamilyGroupMember,
  type FamilyGroupBadgePreset,
  type FamilyGroupMemberPreview,
  type FamilyGroupRole,
  type InvitableFamilyGroupRole,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import {
  canEditMember,
  canEditNickname,
  canRemoveMember,
  canTransferHeadToMember,
} from "@/features/family-groups/lib/family-permissions";
import { parseApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type FamilyGroupMemberRowProps = {
  groupId: string;
  member: FamilyGroupMemberPreview;
  myRole?: FamilyGroupRole | null;
  currentUserId: string;
  onUpdated: () => void;
  onError: (message: string) => void;
};

export function FamilyGroupMemberRow({
  groupId,
  member,
  myRole,
  currentUserId,
  onUpdated,
  onError,
}: FamilyGroupMemberRowProps) {
  const editable = canEditMember(myRole, member.role, currentUserId, member.user_id);
  const nicknameEditable = canEditNickname(myRole, currentUserId, member.user_id);
  const removable = canRemoveMember(myRole, member.role, currentUserId, member.user_id);
  const transferable = canTransferHeadToMember(myRole, member.role, currentUserId, member.user_id);

  const [role, setRole] = useState<InvitableFamilyGroupRole>(
    member.role === "head" ? "contributor" : member.role,
  );
  const [badgeKey, setBadgeKey] = useState(member.badge_key ?? "");
  const [customBadgeLabel, setCustomBadgeLabel] = useState(
    member.badge_key === "custom" ? member.badge_label ?? "" : "",
  );
  const [nickname, setNickname] = useState(member.display_nickname ?? "");
  const [badges, setBadges] = useState<FamilyGroupBadgePreset[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setRole(member.role === "head" ? "contributor" : member.role);
    setBadgeKey(member.badge_key ?? "");
    setCustomBadgeLabel(member.badge_key === "custom" ? member.badge_label ?? "" : "");
    setNickname(member.display_nickname ?? "");
  }, [member]);

  useEffect(() => {
    if (!editable) return;
    void fetchFamilyGroupBadges()
      .then((response) => setBadges(response.items))
      .catch(() => setBadges([]));
  }, [editable]);

  const roleChanged = member.role !== "head" && role !== member.role;
  const badgeChanged =
    (badgeKey || "") !== (member.badge_key ?? "") ||
    (badgeKey === "custom" && customBadgeLabel.trim() !== (member.badge_label ?? ""));
  const nicknameChanged = nickname.trim() !== (member.display_nickname ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const input: Parameters<typeof updateFamilyGroupMember>[2] = {};
      if (roleChanged) input.role = role;
      if (badgeChanged) {
        if (!badgeKey) {
          input.clear_badge = true;
        } else {
          input.badge_key = badgeKey;
          if (badgeKey === "custom") {
            input.badge_label = customBadgeLabel.trim();
          }
        }
      }
      if (nicknameChanged) {
        if (!nickname.trim()) {
          input.clear_nickname = true;
        } else {
          input.display_nickname = nickname.trim();
        }
      }
      await updateFamilyGroupMember(groupId, member.user_id, input);
      onUpdated();
    } catch (error) {
      onError(parseApiError(error).message || copy.familyGroups.governance.errors.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setActing(true);
    try {
      await removeFamilyGroupMember(groupId, member.user_id);
      setRemoveOpen(false);
      onUpdated();
    } catch (error) {
      onError(parseApiError(error).message || copy.familyGroups.governance.errors.removeFailed);
      setRemoveOpen(false);
    } finally {
      setActing(false);
    }
  }

  async function handleTransferHead() {
    setActing(true);
    try {
      await transferFamilyGroupHead(groupId, { new_head_user_id: member.user_id });
      setTransferOpen(false);
      onUpdated();
    } catch (error) {
      onError(parseApiError(error).message || copy.familyGroups.governance.errors.transferFailed);
      setTransferOpen(false);
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5",
          (editable || nicknameEditable) && "space-y-3",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {member.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.profile_image_url} alt="" className="size-full object-cover" />
            ) : (
              <UsersRound className="size-4" strokeWidth={2} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-medium text-foreground">{member.display_name}</p>
            {!editable && !nicknameEditable ? (
              <FamilyMemberRoleBadge
                role={member.role}
                badgeLabel={member.badge_label}
                className="mt-1"
              />
            ) : null}
          </div>
          {transferable ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <Crown className="size-3.5" strokeWidth={2} />
              {copy.familyGroups.governance.transferHeadAction}
            </Button>
          ) : null}
          {removable ? (
            <Button type="button" size="sm" variant="destructive" onClick={() => setRemoveOpen(true)}>
              <Trash2 className="size-3.5" strokeWidth={2} />
              {copy.familyGroups.governance.removeAction}
            </Button>
          ) : null}
        </div>

        {editable ? (
          <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{copy.familyGroups.governance.roleLabel}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as InvitableFamilyGroupRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{copy.familyGroups.invite.roles.viewer}</SelectItem>
                  <SelectItem value="contributor">{copy.familyGroups.invite.roles.contributor}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{copy.familyGroups.governance.badgeLabel}</Label>
              <Select
                value={badgeKey || "none"}
                onValueChange={(value) => setBadgeKey(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={copy.familyGroups.invite.badgePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{copy.familyGroups.invite.badgePlaceholder}</SelectItem>
                  {badges.map((badge) => (
                    <SelectItem key={badge.key} value={badge.key}>
                      {badge.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {badgeKey === "custom" ? (
                <Input
                  value={customBadgeLabel}
                  onChange={(event) => setCustomBadgeLabel(event.target.value)}
                  placeholder={copy.familyGroups.invite.customBadgeLabel}
                  maxLength={64}
                />
              ) : null}
            </div>
            {(roleChanged || badgeChanged) && (
              <div className="sm:col-span-2">
                <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {copy.familyGroups.governance.saveMember}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {nicknameEditable ? (
          <div className={cn("space-y-1.5", editable && "border-t border-border/60 pt-3")}>
            <Label>{copy.familyGroups.governance.nicknameLabel}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={copy.familyGroups.governance.nicknamePlaceholder}
                maxLength={64}
                className="min-w-[200px] flex-1"
              />
              {nicknameChanged ? (
                <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {copy.familyGroups.governance.saveMember}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        variant="destructive"
        title={copy.familyGroups.governance.removeConfirmTitle}
        description={copy.familyGroups.governance.removeConfirmDescription(member.display_name)}
        confirmLabel={copy.familyGroups.governance.removeAction}
        loading={acting}
        onConfirm={() => void handleRemove()}
      />

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title={copy.familyGroups.governance.transferHeadConfirmTitle}
        description={copy.familyGroups.governance.transferHeadConfirmDescription(member.display_name)}
        confirmLabel={copy.familyGroups.governance.transferHeadAction}
        loading={acting}
        onConfirm={() => void handleTransferHead()}
      />
    </>
  );
}
