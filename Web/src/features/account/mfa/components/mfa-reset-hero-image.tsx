"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const MFA_RESET_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaResetHeroImageProps = {
  className?: string;
};

export function MfaResetHeroImage({ className }: MfaResetHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/reset-mfa.png"
        alt={copy.mfa.reset.verifyTitle}
        width={1536}
        height={1024}
        sizes={MFA_RESET_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
