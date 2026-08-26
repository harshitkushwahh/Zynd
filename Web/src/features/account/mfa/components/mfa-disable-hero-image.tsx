"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const MFA_DISABLE_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaDisableHeroImageProps = {
  className?: string;
};

export function MfaDisableHeroImage({ className }: MfaDisableHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/disable-mfa.png"
        alt={copy.mfa.disable.title}
        width={1536}
        height={1024}
        sizes={MFA_DISABLE_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
