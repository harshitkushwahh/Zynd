"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

const ZTO_LOOKUP_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type ZtoLookupHeroImageProps = {
  className?: string;
  alt: string;
};

export function ZtoLookupHeroImage({ className, alt }: ZtoLookupHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/lookup.png"
        alt={alt}
        width={1536}
        height={1024}
        sizes={ZTO_LOOKUP_HERO_SIZES}
        className="h-auto w-full object-contain"
        priority
      />
    </div>
  );
}
