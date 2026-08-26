"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const REVEAL_BACKUP_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaRevealBackupHeroImageProps = {
  className?: string;
};

export function MfaRevealBackupHeroImage({ className }: MfaRevealBackupHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/reveal-backup-code.png"
        alt={copy.mfa.backupAccess.reveal}
        width={1536}
        height={1024}
        sizes={REVEAL_BACKUP_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
