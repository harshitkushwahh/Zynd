"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const DELETE_ACCOUNT_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type DeleteAccountHeroImageProps = {
  className?: string;
};

export function DeleteAccountHeroImage({ className }: DeleteAccountHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/account-delete.png"
        alt=""
        width={1536}
        height={1024}
        sizes={DELETE_ACCOUNT_HERO_SIZES}
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
      />
    </div>
  );
}
