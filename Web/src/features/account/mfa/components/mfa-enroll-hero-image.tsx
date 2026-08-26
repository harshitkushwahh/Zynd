"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const MFA_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaEnrollHeroImageProps = {
  className?: string;
};

export function MfaEnrollHeroImage({ className }: MfaEnrollHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/zynd-mfa.png"
        alt={copy.mfa.enroll.startTitle}
        width={1451}
        height={1084}
        sizes={MFA_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
