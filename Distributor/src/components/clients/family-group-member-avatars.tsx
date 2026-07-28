"use client";

import { Crown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DistributorClientFamilyMember } from "@/lib/dummy/types";
import { cn } from "@/lib/utils";

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type FamilyGroupMemberAvatarsProps = {
  members: DistributorClientFamilyMember[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-8 text-micro",
  md: "size-10 text-caption",
  lg: "size-14 text-body",
} as const;

export function FamilyGroupMemberAvatars({
  members,
  maxVisible = 5,
  size = "md",
  className,
}: FamilyGroupMemberAvatarsProps) {
  const visible = members.slice(0, maxVisible);
  const overflow = members.length - visible.length;

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((member, index) => (
        <div
          key={member.userId}
          className={cn("relative shrink-0", index > 0 && "-ml-2.5")}
          style={{ zIndex: visible.length - index }}
          title={member.displayName}
        >
          <Avatar
            className={cn(
              SIZE_CLASS[size],
              "ring-2 ring-card",
            )}
          >
            {member.profileImageUrl ? (
              <AvatarImage src={member.profileImageUrl} alt="" />
            ) : null}
            <AvatarFallback className="font-semibold">{memberInitials(member.displayName)}</AvatarFallback>
          </Avatar>
          {member.role === "head" ? (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
              <Crown className="size-2.5" strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
      ))}
      {overflow > 0 ? (
        <div
          className={cn(
            "-ml-2.5 flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card",
            SIZE_CLASS[size],
          )}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
