"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const INVITE_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type FamilyGroupInviteHeroImageProps = {
  className?: string;
};

export function FamilyGroupInviteHeroImage({ className }: FamilyGroupInviteHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/family-group-invite.png"
        alt=""
        width={1536}
        height={1024}
        sizes={INVITE_HERO_SIZES}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
