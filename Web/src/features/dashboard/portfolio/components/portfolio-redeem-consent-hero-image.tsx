"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const REDEEM_HERO_SIZES = "(max-width: 640px) 240px, 272px";

type PortfolioRedeemConsentHeroImageProps = {
  className?: string;
};

export function PortfolioRedeemConsentHeroImage({ className }: PortfolioRedeemConsentHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/redeem.png"
        alt={copy.dashboard.portfolio.redeemConsentTitle}
        width={1536}
        height={1024}
        sizes={REDEEM_HERO_SIZES}
        className="h-auto w-full max-w-[min(100%,15rem)] object-contain sm:max-w-[17rem]"
      />
    </div>
  );
}
