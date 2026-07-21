"use client";

import { UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BrandDialog } from "@/components/ui/brand-dialog";
import type { FamilyGroupDetail } from "@/features/family-groups/api/family-groups-api";
import {
  FamilyGroupMemberRow,
  MemberDetailsGrid,
} from "@/features/family-groups/components/family-group-member-row";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

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
  isHead?: boolean;
  mode?: "view" | "manage";
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
  isHead = false,
  mode = "view",
}: FamilyGroupManageMembersDialogProps) {
  const atCapacity = reservedSlots >= memberLimit;
  const dialogTitle =
    mode === "manage"
      ? copy.familyGroups.dashboard.manageSectionTitle
      : copy.familyGroups.dashboard.viewGroupSectionTitle;

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description={
        isHead
          ? copy.familyGroups.dashboard.manageSectionDescriptionHead(group.title)
          : copy.familyGroups.dashboard.manageSectionDescriptionMember(group.title)
      }
      icon={UsersRound}
      maxWidth="lg"
      className="max-w-2xl"
      headerAction={
        <Badge
          variant="secondary"
          className="border-primary-foreground/20 bg-primary-foreground/10 font-normal tabular-nums text-primary-foreground"
        >
          {reservedSlots}/{memberLimit}
        </Badge>
      }
    >
      <div className="max-h-[min(70vh,36rem)] space-y-6 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        <section className="space-y-3">
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
                className={cn(
                  "overflow-hidden border border-border bg-card shadow-zynd-low",
                  FAMILY_GROUP_CARD_RADIUS_CLASS,
                )}
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
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
                <MemberDetailsGrid member={member} />
              </div>
            ),
          )}
        </section>

        {leaveBlocked ? (
          <p className="rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-compact text-amber-900 dark:text-amber-100">
            {leaveBlocked}
          </p>
        ) : null}

        {isHead && atCapacity ? (
          <p className="rounded-[var(--radius-control)] border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-compact text-amber-900 dark:text-amber-100">
            {copy.familyGroups.invite.capacityReached(memberLimit)}
          </p>
        ) : null}

        {saveError ? <p className="text-compact text-destructive">{saveError}</p> : null}
      </div>
    </BrandDialog>
  );
}
