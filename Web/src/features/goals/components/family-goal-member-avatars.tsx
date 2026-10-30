"use client";

import { useEffect, useState } from "react";

import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  familyMemberInitials,
  zyndAvatarVariantForSeed,
} from "@/features/family-groups/lib/family-group-ui";
import { FAMILY_GOAL_CARD_MEMBER_AVATAR_LIMIT } from "@/features/goals/lib/goal-family-goals";
import { cn } from "@/lib/utils";

type FamilyGoalMemberAvatarsProps = {
  members: FamilyGroupMemberPreview[];
  memberCount: number;
  className?: string;
};

function MemberAvatarCircle({ member }: { member: FamilyGroupMemberPreview }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = member.profile_image_url?.trim() || null;
  const showImage = Boolean(imageUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const variant = zyndAvatarVariantForSeed(member.user_id || member.display_name);

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "text-[10px] font-semibold",
        showImage
          ? "ring-2 ring-white/85 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.75)] dark:ring-white/25"
          : "ring-2 ring-white/70 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.75)] dark:ring-white/25",
      )}
      style={showImage ? undefined : { backgroundColor: variant.bg, color: variant.fg }}
      title={member.display_name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        familyMemberInitials(member.display_name)
      )}
    </div>
  );
}

function OverflowMemberBadge({
  count,
  memberCount,
}: {
  count: number;
  memberCount: number;
}) {
  const variant = zyndAvatarVariantForSeed(`overflow-${memberCount}`);

  return (
    <li className="family-goal-card__members-item family-goal-card__members-more">
      <span
        className="flex size-9 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ring-2 ring-white/70 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.75)] dark:ring-white/25"
        style={{ backgroundColor: variant.bg, color: variant.fg }}
        title={`${count} more members`}
      >
        +{count}
      </span>
    </li>
  );
}

export function FamilyGoalMemberAvatars({
  members,
  memberCount,
  className,
}: FamilyGoalMemberAvatarsProps) {
  const visibleMembers = members.slice(0, FAMILY_GOAL_CARD_MEMBER_AVATAR_LIMIT);
  const overflowCount = Math.max(0, memberCount - visibleMembers.length);

  if (visibleMembers.length === 0) return null;

  return (
    <div
      className={cn("family-goal-card__members", className)}
      aria-label={`${memberCount} family members`}
    >
      <ul className="family-goal-card__members-list">
        {visibleMembers.map((member, index) => (
          <li
            key={member.user_id}
            className="family-goal-card__members-item"
            style={{ zIndex: visibleMembers.length - index }}
          >
            <MemberAvatarCircle member={member} />
          </li>
        ))}
        {overflowCount > 0 ? (
          <OverflowMemberBadge count={overflowCount} memberCount={memberCount} />
        ) : null}
      </ul>
    </div>
  );
}
