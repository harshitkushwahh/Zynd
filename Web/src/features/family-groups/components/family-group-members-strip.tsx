"use client";

import Link from "next/link";
import { Crown, LogOut, Plus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { buildFamilyGroupDetailHref } from "@/features/family-groups/lib/family-group-navigation";
import {
  FAMILY_GROUP_DASHBOARD_PANEL_CLASS,
  familyMemberInitials,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupMembersStripProps = {
  group: FamilyGroupSummary;
  groups: FamilyGroupSummary[];
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  canInvite: boolean;
  inviteDisabled?: boolean;
  onInvite: () => void;
  memberCount: number;
  pendingInvites?: number;
  memberLimit: number;
  canLeave?: boolean;
  onLeave?: () => void;
  className?: string;
};

function MemberChip({
  member,
  isCurrentUser,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser: boolean;
}) {
  const youLabel = copy.familyGroups.dashboard.orbitMemberDetail.youLabel;
  const label = isCurrentUser ? `${member.display_name} (${youLabel})` : member.display_name;

  return (
    <div className="relative z-10 shrink-0 hover:z-20 focus-within:z-20" title={label}>
      <div
        className={cn(
          "group flex h-10 max-w-10 items-center overflow-hidden rounded-full",
          "border border-border/80 bg-card shadow-zynd-low outline-none",
          "transition-[max-width,border-color,box-shadow] duration-200 ease-out",
          "hover:max-w-56 hover:border-primary/30 hover:shadow-zynd-mid",
          "focus-within:max-w-56 focus-within:border-primary/30 focus-within:shadow-zynd-mid",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center">
          <div className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15">
            {member.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.profile_image_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[10px] font-semibold text-primary">
                {familyMemberInitials(member.display_name)}
              </span>
            )}
          </div>
        </div>

        <span
          className={cn(
            "min-w-0 overflow-hidden whitespace-nowrap pr-3 text-caption font-semibold text-foreground",
            "max-w-0 opacity-0 transition-[max-width,opacity] duration-200 ease-out",
            "group-hover:max-w-44 group-hover:opacity-100",
            "group-focus-within:max-w-44 group-focus-within:opacity-100",
          )}
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate">{member.display_name}</span>
            {isCurrentUser ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary">
                {youLabel}
              </span>
            ) : null}
          </span>
        </span>
      </div>

      {member.role === "head" ? (
        <span className="pointer-events-none absolute right-0 top-0 z-30 flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
          <Crown className="size-2.5" strokeWidth={2.25} />
        </span>
      ) : null}
    </div>
  );
}

function InviteChip({
  disabled,
  onInvite,
}: {
  disabled?: boolean;
  onInvite: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onInvite}
      aria-label={copy.familyGroups.invite.action}
      className={cn(
        "relative z-10 flex h-10 shrink-0 items-center gap-0 overflow-hidden rounded-full pr-3",
        "border border-dashed border-primary/40 bg-primary/5 text-primary outline-none",
        "transition-[border-color,background-color] duration-200 ease-out",
        "hover:z-20 hover:border-primary/60 hover:bg-primary/10",
        "focus-visible:z-20 focus-visible:border-primary/60 focus-visible:bg-primary/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center">
        <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-primary/40 bg-background">
          <Plus className="size-4" strokeWidth={2.25} />
        </span>
      </span>
      <span className="whitespace-nowrap text-caption font-semibold">
        {copy.familyGroups.invite.action}
      </span>
    </button>
  );
}

export function FamilyGroupMembersStrip({
  group,
  groups,
  members,
  currentUserId,
  canInvite,
  inviteDisabled,
  onInvite,
  memberCount,
  pendingInvites = 0,
  memberLimit,
  canLeave = false,
  onLeave,
  className,
}: FamilyGroupMembersStripProps) {
  return (
    <section
      className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "flex items-center gap-3 p-3 sm:p-4", className)}
    >
      <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
        {memberCount}/{memberLimit}
      </Badge>
      {pendingInvites > 0 ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {copy.familyGroups.dashboard.pendingInvites(pendingInvites)}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:thin]">
        {members.map((member) => (
          <MemberChip
            key={member.user_id}
            member={member}
            isCurrentUser={member.user_id === currentUserId}
          />
        ))}

        {canInvite ? <InviteChip disabled={inviteDisabled} onInvite={onInvite} /> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          nativeButton={false}
          render={<Link href={buildFamilyGroupDetailHref(group, groups)} />}
        >
          <UsersRound className="size-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">{copy.familyGroups.dashboard.viewGroupAction}</span>
        </Button>
        {canLeave && onLeave ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            onClick={onLeave}
          >
            <LogOut className="size-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">{copy.familyGroups.detail.leaveAction}</span>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
