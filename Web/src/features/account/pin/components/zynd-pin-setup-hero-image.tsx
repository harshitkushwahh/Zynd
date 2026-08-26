"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PIN_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type ZyndPinSetupHeroImageProps = {
  className?: string;
};

export function ZyndPinSetupHeroImage({ className }: ZyndPinSetupHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/zynd-pin.png"
        alt={copy.pin.setupSteps.verifyTitle}
        width={1536}
        height={1024}
        sizes={PIN_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
