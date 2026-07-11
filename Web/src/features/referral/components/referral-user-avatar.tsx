"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileImageOptional } from "@/contexts/profile-image-context";
import { initialsFromName } from "@/features/referral/lib/referral-initials";
import { cn } from "@/lib/utils";

type ReferralUserAvatarProps = {
  name: string;
  imageUrl?: string | null;
  isCurrentUser?: boolean;
  className?: string;
  fallbackClassName?: string;
};

export function ReferralUserAvatar({
  name,
  imageUrl,
  isCurrentUser = false,
  className,
  fallbackClassName,
}: ReferralUserAvatarProps) {
  const profileImage = useProfileImageOptional();
  const resolvedImageUrl =
    imageUrl ?? (isCurrentUser ? profileImage?.profileUrl : null);
  const initials = initialsFromName(name);

  return (
    <Avatar className={cn("shrink-0 after:hidden", className)}>
      {resolvedImageUrl ? <AvatarImage src={resolvedImageUrl} alt={name} /> : null}
      <AvatarFallback
        className={cn(
          "bg-muted text-caption font-semibold text-foreground",
          fallbackClassName
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
