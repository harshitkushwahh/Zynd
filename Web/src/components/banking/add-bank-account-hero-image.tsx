"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const ADD_BANK_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type AddBankAccountHeroImageProps = {
  className?: string;
};

export function AddBankAccountHeroImage({ className }: AddBankAccountHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/add-bank-acc.png"
        alt=""
        width={1536}
        height={1024}
        sizes={ADD_BANK_HERO_SIZES}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
