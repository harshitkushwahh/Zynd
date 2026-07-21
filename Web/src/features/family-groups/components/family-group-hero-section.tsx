"use client";

import { useEffect, useMemo, useState } from "react";

import { FamilyGroupOrbitMemberDetail } from "@/features/family-groups/components/family-group-orbit-member-detail";
import { FamilyGroupOrbitMemberFilter } from "@/features/family-groups/components/family-group-orbit-member-filter";
import { FamilyGroupOrbitVisual } from "@/features/family-groups/components/family-group-orbit-visual";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  FAMILY_GROUP_CARD_RADIUS_CLASS,
  FAMILY_GROUP_HERO_GRADIENT_CLASS,
  FAMILY_GROUP_HERO_OVERLAY_CLASS,
  pickOrbitMembers,
} from "@/features/family-groups/lib/family-group-ui";
import { cn } from "@/lib/utils";

type FamilyGroupHeroSectionProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  canInvite?: boolean;
  onInviteMember?: () => void;
  className?: string;
};

export function FamilyGroupHeroSection({
  members,
  currentUserId,
  canInvite = false,
  onInviteMember,
  className,
}: FamilyGroupHeroSectionProps) {
  const { center } = useMemo(() => pickOrbitMembers(members, currentUserId), [members, currentUserId]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(center?.user_id ?? null);

  useEffect(() => {
    setSelectedMemberId((current) => {
      if (current && members.some((member) => member.user_id === current)) {
        return current;
      }
      return center?.user_id ?? null;
    });
  }, [center?.user_id, members]);

  const selectedMember =
    members.find((member) => member.user_id === selectedMemberId) ?? center ?? null;

  return (
    <section
      className={cn(
        "relative isolate flex min-h-[24rem] min-w-0 flex-1 flex-col overflow-hidden p-4 shadow-zynd-mid ring-1 ring-inset ring-primary-foreground/10 sm:min-h-[26rem] sm:p-5 lg:p-6",
        FAMILY_GROUP_CARD_RADIUS_CLASS,
        FAMILY_GROUP_HERO_GRADIENT_CLASS,
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit]",
          FAMILY_GROUP_HERO_OVERLAY_CLASS,
        )}
      />
      <div className="pointer-events-none absolute left-0 top-0 size-40 -translate-x-1/4 -translate-y-1/4 rounded-full bg-[color-mix(in_srgb,var(--zynd-navy)_22%,var(--zynd-blue-dark))] opacity-[0.24] blur-3xl" />
      <div className="pointer-events-none absolute left-[8%] top-[38%] size-44 rounded-full bg-[color-mix(in_srgb,var(--zynd-blue)_28%,white)] opacity-[0.22] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[18%] size-40 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_20%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[18%] right-0 size-40 translate-x-1/4 rounded-full bg-[color-mix(in_srgb,var(--zynd-blue-dark)_55%,var(--zynd-blue))] opacity-[0.18] blur-3xl" />

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <FamilyGroupOrbitVisual
              members={members}
              currentUserId={currentUserId}
              selectedMemberId={selectedMemberId}
              onMemberSelect={setSelectedMemberId}
              canInvite={canInvite}
              onInviteMember={onInviteMember}
              className="aspect-square h-full max-h-full w-auto max-w-full"
            />
          </div>
          <FamilyGroupOrbitMemberFilter
            members={members}
            currentUserId={currentUserId}
            selectedMemberId={selectedMemberId}
            onSelect={setSelectedMemberId}
            className="relative z-10 max-w-[22rem] shrink-0"
          />
        </div>

        <FamilyGroupOrbitMemberDetail
          member={selectedMember}
          currentUserId={currentUserId}
          className="min-h-[18rem] md:min-h-0 md:self-stretch"
        />
      </div>
    </section>
  );
}
