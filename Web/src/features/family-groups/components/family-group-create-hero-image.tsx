"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const CREATE_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type FamilyGroupCreateHeroImageProps = {
  className?: string;
};

export function FamilyGroupCreateHeroImage({ className }: FamilyGroupCreateHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/create-family-m.png"
        alt=""
        width={1536}
        height={1024}
        sizes={CREATE_HERO_SIZES}
        unoptimized
        className="h-auto w-full object-contain"
        priority
      />
    </div>
  );
}
