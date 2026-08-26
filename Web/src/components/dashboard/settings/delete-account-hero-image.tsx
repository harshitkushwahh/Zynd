"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const DELETE_ACCOUNT_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type DeleteAccountHeroImageProps = {
  className?: string;
};

export function DeleteAccountHeroImage({ className }: DeleteAccountHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/zynd-account-delete.png"
        alt={copy.settings.confirmAccountDeletionTitle}
        width={1536}
        height={1024}
        sizes={DELETE_ACCOUNT_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
