"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-8 text-caption",
  md: "size-9 text-compact",
  lg: "size-10 text-compact",
} as const;

export type DistributorProfileAvatarProps = {
  name: string;
  imageSrc?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function DistributorProfileAvatar({
  name,
  imageSrc,
  size = "md",
  className,
}: DistributorProfileAvatarProps) {
  const initials = getDisplayInitials(name);
  const resolvedSrc = imageSrc?.trim() || undefined;

  return (
    <Avatar
      className={cn(
        "distributor-profile-avatar",
        sizeClasses[size],
        "after:border-0",
        className,
      )}
    >
      {resolvedSrc ? <AvatarImage src={resolvedSrc} alt="" /> : null}
      <AvatarFallback className="distributor-profile-avatar__fallback">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
