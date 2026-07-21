"use client";

import { Crown, Plus, UsersRound } from "lucide-react";

import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import { familyMemberInitials } from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type FamilyGroupMembersStripProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  canInvite: boolean;
  inviteDisabled?: boolean;
  onInvite: () => void;
  onManageMembers: () => void;
  className?: string;
};

function MemberCard({
  member,
  isCurrentUser,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser: boolean;
}) {
  return (
    <div className="group relative min-w-[9.5rem] max-w-[10.5rem] shrink-0 rounded-[var(--radius-medium)] border border-border/80 bg-card p-3 shadow-zynd-low transition hover:border-primary/25 hover:shadow-zynd-mid">
      <div className="relative mx-auto w-fit">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15">
          {member.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.profile_image_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-caption font-semibold text-primary">
              {familyMemberInitials(member.display_name)}
            </span>
          )}
        </div>
        {member.role === "head" ? (
          <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-amber-400 text-amber-950">
            <Crown className="size-3" strokeWidth={2.25} />
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <p className="truncate text-caption font-semibold text-foreground">{member.display_name}</p>
          {isCurrentUser ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
              You
            </span>
          ) : null}
        </div>
        <FamilyMemberRoleBadge
          role={member.role}
          badgeLabel={member.badge_label}
          className="mt-2 justify-center"
        />
      </div>
    </div>
  );
}

export function FamilyGroupMembersStrip({
  members,
  currentUserId,
  canInvite,
  inviteDisabled,
  onInvite,
  onManageMembers,
  className,
}: FamilyGroupMembersStripProps) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-zynd-low sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-foreground">{copy.familyGroups.dashboard.membersTitle}</h3>
          <p className="mt-1 text-compact text-muted-foreground">{copy.familyGroups.dashboard.membersSubtitle}</p>
        </div>
        <button
          type="button"
          className="text-compact font-medium text-primary transition hover:text-primary/80"
          onClick={onManageMembers}
        >
          {copy.familyGroups.dashboard.manageMembersAction}
        </button>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {members.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            isCurrentUser={member.user_id === currentUserId}
          />
        ))}

        {canInvite ? (
          <button
            type="button"
            disabled={inviteDisabled}
            onClick={onInvite}
            className="flex min-w-[9.5rem] max-w-[10.5rem] shrink-0 flex-col items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-primary/35 bg-primary/5 px-4 py-6 text-primary transition hover:border-primary/60 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex size-14 items-center justify-center rounded-full border border-dashed border-primary/40 bg-background">
              <Plus className="size-6" strokeWidth={2} />
            </div>
            <p className="mt-3 text-caption font-semibold">{copy.familyGroups.invite.action}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <UsersRound className="size-3" strokeWidth={2} />
              {copy.familyGroups.dashboard.inviteHint}
            </p>
          </button>
        ) : null}
      </div>
    </section>
  );
}
