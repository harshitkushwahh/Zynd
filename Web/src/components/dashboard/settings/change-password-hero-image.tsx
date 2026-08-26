"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHANGE_PASSWORD_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type ChangePasswordHeroImageProps = {
  className?: string;
};

export function ChangePasswordHeroImage({ className }: ChangePasswordHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/password-change.png"
        alt={copy.settings.changePasswordTitle}
        width={1536}
        height={1024}
        sizes={CHANGE_PASSWORD_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
