"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const MFA_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type MfaEnrollHeroImageProps = {
  className?: string;
};

export function MfaEnrollHeroImage({ className }: MfaEnrollHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/zynd-mfa.png"
        alt=""
        width={1451}
        height={1084}
        sizes={MFA_HERO_SIZES}
        unoptimized
        className="h-auto w-full object-contain"
        priority
      />
    </div>
  );
}
