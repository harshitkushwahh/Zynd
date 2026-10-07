"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const REVEAL_BACKUP_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type MfaRevealBackupHeroImageProps = {
  className?: string;
  compact?: boolean;
};

export function MfaRevealBackupHeroImage({ className, compact = false }: MfaRevealBackupHeroImageProps) {
  return (
    <div className={cn("flex shrink-0 justify-center", className)}>
      <Image
        src="/reveal-backup-code.png"
        alt={copy.mfa.backupAccess.reveal}
        width={1536}
        height={1024}
        sizes={REVEAL_BACKUP_HERO_SIZES}
        unoptimized
        className={cn(
          "h-auto w-full object-contain",
          compact ? "max-w-[10.5rem] sm:max-w-[11.5rem]" : "max-w-[min(100%,15rem)] sm:max-w-[17rem]",
        )}
        priority
      />
    </div>
  );
}
