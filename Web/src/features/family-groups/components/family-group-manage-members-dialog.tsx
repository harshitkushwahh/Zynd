"use client";

import { Settings2, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandDialog } from "@/components/ui/brand-dialog";
import type {
  FamilyGroupDetail,
  FamilyGroupInvite,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupMemberRow } from "@/features/family-groups/components/family-group-member-row";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import { copy } from "@/shared/config/copy";

type FamilyGroupManageMembersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: FamilyGroupDetail;
  currentUserId?: string | null;
  reservedSlots: number;
  memberLimit: number;
  leaveBlocked?: string | null;
  saveError?: string;
  onMemberUpdated: () => void;
  onMemberError: (message: string) => void;
  onRevokeInvite: (invite: FamilyGroupInvite) => void;
  onOpenSettings?: () => void;
  isHead?: boolean;
};

export function FamilyGroupManageMembersDialog({
  open,
  onOpenChange,
  group,
  currentUserId,
  reservedSlots,
  memberLimit,
  leaveBlocked,
  saveError,
  onMemberUpdated,
  onMemberError,
  onRevokeInvite,
  onOpenSettings,
  isHead = false,
}: FamilyGroupManageMembersDialogProps) {
  const pendingInvites = group.invites?.filter((invite) => invite.status === "pending") ?? [];

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.familyGroups.dashboard.manageSectionTitle}
      description={copy.familyGroups.invite.capacityLabel(reservedSlots, memberLimit)}
      icon={UsersRound}
      maxWidth="lg"
      className="max-w-2xl"
    >
      <div className="max-h-[min(70vh,36rem)] overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        {isHead && onOpenSettings ? (
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenSettings();
              }}
            >
              <Settings2 className="size-4" strokeWidth={2} />
              {copy.familyGroups.dashboard.settingsTitle}
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {group.members.map((member) =>
            currentUserId ? (
              <FamilyGroupMemberRow
                key={member.user_id}
                groupId={group.id}
                member={member}
                myRole={group.my_role}
                currentUserId={currentUserId}
                onUpdated={onMemberUpdated}
                onError={onMemberError}
              />
            ) : (
              <div
                key={member.user_id}
                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-3 py-2.5"
              >
                <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                  {member.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.profile_image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <UsersRound className="size-4" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-caption font-medium text-foreground">{member.display_name}</p>
                  <FamilyMemberRoleBadge
                    role={member.role}
                    badgeLabel={member.badge_label}
                    className="mt-1"
                  />
                </div>
              </div>
            ),
          )}
        </div>

        {leaveBlocked ? (
          <p className="mt-4 text-compact text-muted-foreground">{leaveBlocked}</p>
        ) : null}

        {isHead && pendingInvites.length > 0 ? (
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-caption font-semibold text-foreground">{copy.familyGroups.invite.pendingTitle}</h4>
            <div className="mt-3 space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-dashed border-border/80 px-3 py-2"
                >
                  <div>
                    <p className="text-caption font-medium text-foreground">
                      {invite.invitee_email ?? copy.familyGroups.invite.linkRecipient}
                    </p>
                    <p className="text-[11px] capitalize text-muted-foreground">{invite.intended_role}</p>
                  </div>
                  <div className="flex gap-2">
                    {invite.share_url ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(invite.share_url ?? "");
                        }}
                      >
                        {copy.familyGroups.invite.copyLink}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRevokeInvite(invite)}
                    >
                      {copy.familyGroups.invite.revoke}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {saveError ? <p className="mt-4 text-compact text-destructive">{saveError}</p> : null}
      </div>
    </BrandDialog>
  );
}
