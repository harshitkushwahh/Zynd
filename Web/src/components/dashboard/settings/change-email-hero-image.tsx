"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHANGE_EMAIL_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type ChangeEmailHeroImageProps = {
  className?: string;
};

export function ChangeEmailHeroImage({ className }: ChangeEmailHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/email-update.png"
        alt={copy.settings.changeEmailMfaTitle}
        width={1536}
        height={1024}
        sizes={CHANGE_EMAIL_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
