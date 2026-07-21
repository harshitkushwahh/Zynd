"use client";

import { Crown, UsersRound } from "lucide-react";

import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  familyMemberInitials,
  familyRoleLabel,
  pickOrbitMembers,
} from "@/features/family-groups/lib/family-group-ui";
import { cn } from "@/lib/utils";

type FamilyGroupOrbitVisualProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  className?: string;
};

function OrbitMemberAvatar({
  member,
  compact = false,
}: {
  member: FamilyGroupMemberPreview;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", compact ? "flex-col gap-1" : "flex-row")}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary/30 shadow-[0_0_24px_color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)]",
          compact ? "size-11" : "size-14",
        )}
      >
        {member.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.profile_image_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-primary/15 text-[11px] font-semibold text-primary">
            {familyMemberInitials(member.display_name)}
          </div>
        )}
      </div>
      {!compact ? (
        <div className="min-w-0 max-w-[7rem]">
          <p className="truncate text-[11px] font-semibold text-primary-foreground">{member.display_name}</p>
          <p className="truncate text-[10px] text-primary-foreground/65">
            {familyRoleLabel(member.role, member.badge_label)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CenterHub({
  member,
  isCurrentUser,
}: {
  member: FamilyGroupMemberPreview;
  isCurrentUser: boolean;
}) {
  return (
    <div className="relative z-20 flex flex-col items-center text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_22%,transparent)] blur-xl" />
        <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-[color-mix(in_srgb,var(--zynd-emerald)_35%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)] shadow-[0_0_40px_color-mix(in_srgb,var(--zynd-emerald)_40%,transparent)] sm:size-28">
          {member.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.profile_image_url} alt="" className="size-full object-cover" />
          ) : (
            <UsersRound className="size-10 text-primary-foreground/80" strokeWidth={1.75} />
          )}
        </div>
        {member.role === "head" ? (
          <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-zynd-mid">
            <Crown className="size-3.5" strokeWidth={2.25} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-caption font-semibold text-primary-foreground">
        {isCurrentUser ? "You" : member.display_name}
      </p>
      <p className="mt-0.5 text-[11px] text-primary-foreground/70">
        {familyRoleLabel(member.role, member.badge_label)}
      </p>
    </div>
  );
}

export function FamilyGroupOrbitVisual({
  members,
  currentUserId,
  className,
}: FamilyGroupOrbitVisualProps) {
  const { center, orbiting } = pickOrbitMembers(members, currentUserId);
  const innerOrbit = orbiting.slice(0, 2);
  const outerOrbit = orbiting.slice(2, 6);

  if (!center) {
    return (
      <div className={cn("flex h-[22rem] items-center justify-center", className)}>
        <p className="text-compact text-primary-foreground/70">Add members to see your family orbit.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-[22rem] w-full sm:h-[24rem]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--zynd-emerald)_12%,transparent)_0%,transparent_68%)]" />

      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <CenterHub member={center} isCurrentUser={center.user_id === currentUserId} />
      </div>

      {innerOrbit.length > 0 ? (
        <OrbitingCircles radius={108} duration={28} iconSize={72} path>
          {innerOrbit.map((member) => (
            <OrbitMemberAvatar key={member.user_id} member={member} />
          ))}
        </OrbitingCircles>
      ) : null}

      {outerOrbit.length > 0 ? (
        <OrbitingCircles radius={168} duration={36} reverse iconSize={72} path>
          {outerOrbit.map((member) => (
            <OrbitMemberAvatar key={member.user_id} member={member} compact />
          ))}
        </OrbitingCircles>
      ) : null}

      <div className="pointer-events-none absolute left-[18%] top-[22%] size-2 rounded-full bg-amber-400/80 blur-[1px]" />
      <div className="pointer-events-none absolute right-[20%] top-[30%] size-1.5 rounded-full bg-sky-400/80 blur-[1px]" />
      <div className="pointer-events-none absolute bottom-[24%] left-[28%] size-1.5 rounded-full bg-emerald-400/80 blur-[1px]" />
      <div className="pointer-events-none absolute bottom-[18%] right-[24%] size-2 rounded-full bg-violet-400/70 blur-[1px]" />
    </div>
  );
}
