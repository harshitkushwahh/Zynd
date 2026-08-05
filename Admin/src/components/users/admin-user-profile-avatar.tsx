"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userInitials } from "@/lib/admin-capabilities";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-8 text-caption",
  md: "size-10 text-compact",
  lg: "size-16 text-xl",
  xl: "size-20 text-2xl",
} as const;

export type AdminUserProfileAvatarProps = {
  name: string;
  email?: string;
  imageSrc?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function AdminUserProfileAvatar({
  name,
  email,
  imageSrc,
  size = "md",
  className,
}: AdminUserProfileAvatarProps) {
  const initials = userInitials(email ?? name);
  const resolvedSrc = imageSrc?.trim() || undefined;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {resolvedSrc ? <AvatarImage src={resolvedSrc} alt={name} /> : null}
      <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback>
    </Avatar>
  );
}
