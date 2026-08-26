"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const INVITE_HERO_SIZES = "(max-width: 640px) 200px, 240px";

type FamilyGroupInviteHeroImageProps = {
  className?: string;
};

export function FamilyGroupInviteHeroImage({ className }: FamilyGroupInviteHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/invite-group.png"
        alt={copy.familyGroups.invite.title}
        width={1536}
        height={1024}
        sizes={INVITE_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,14rem)] object-contain sm:max-w-[16rem]"
        priority
      />
    </div>
  );
}
