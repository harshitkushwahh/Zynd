"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminFamilyGroupHeadBadge } from "@/components/users/admin-family-group-head-badge";
import type { AdminFamilyGroupMemberPreview } from "@/lib/family-groups-admin-api";
import { cn } from "@/lib/utils";

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type AdminFamilyGroupMemberAvatarsProps = {
  members: AdminFamilyGroupMemberPreview[];
  maxVisible?: number;
  totalCount?: number;
  className?: string;
};

export function AdminFamilyGroupMemberAvatars({
  members,
  maxVisible = 4,
  totalCount,
  className,
}: AdminFamilyGroupMemberAvatarsProps) {
  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(0, (totalCount ?? members.length) - visible.length);

  return (
    <div className={cn("admin-family-group-member-avatars", className)}>
      {visible.map((member, index) => (
        <div
          key={member.user_id}
          className={cn("admin-family-group-member-avatars__item", index > 0 && "-ml-2.5")}
          style={{ zIndex: visible.length - index }}
          title={member.display_name}
        >
          <Avatar
            className={cn(
              "admin-family-group-member-avatars__avatar size-8",
              member.role === "head" && "admin-family-group-member-avatars__avatar--head",
            )}
          >
            {member.profile_image_url ? <AvatarImage src={member.profile_image_url} alt="" /> : null}
            <AvatarFallback className="text-micro font-semibold">
              {memberInitials(member.display_name)}
            </AvatarFallback>
          </Avatar>
          {member.role === "head" ? <AdminFamilyGroupHeadBadge /> : null}
        </div>
      ))}
      {overflow > 0 ? (
        <div className="admin-family-group-member-avatars__overflow -ml-2.5">+{overflow}</div>
      ) : null}
    </div>
  );
}
