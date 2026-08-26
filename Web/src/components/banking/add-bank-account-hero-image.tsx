"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ADD_BANK_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type AddBankAccountHeroImageProps = {
  className?: string;
};

export function AddBankAccountHeroImage({ className }: AddBankAccountHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/add-bank.png"
        alt={copy.settings.bankAccounts.addTitle}
        width={1536}
        height={1024}
        sizes={ADD_BANK_HERO_SIZES}
        unoptimized
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
        priority
      />
    </div>
  );
}
