"use client";

import Image from "next/image";

import digiImage from "../../../../public/digi.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerImageProps = {
  className?: string;
  variant?: "default" | "hero";
};

export function KycDigilockerImage({ className, variant = "default" }: KycDigilockerImageProps) {
  return (
    <div className={className}>
      <Image
        src={digiImage}
        alt={copy.kyc.digilocker.title}
        className={cn(
          "mx-auto object-contain",
          variant === "hero" ? "max-h-28 max-w-[180px]" : "max-h-32 max-w-[200px]",
        )}
        priority
      />
    </div>
  );
}
