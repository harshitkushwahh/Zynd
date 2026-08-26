"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const BACKUP_CODES_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaRegenerateBackupHeroImageProps = {
  className?: string;
};

export function MfaRegenerateBackupHeroImage({ className }: MfaRegenerateBackupHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/zynd-backup-codes.png"
        alt={copy.mfa.regenerate.title}
        width={1536}
        height={1024}
        sizes={BACKUP_CODES_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
