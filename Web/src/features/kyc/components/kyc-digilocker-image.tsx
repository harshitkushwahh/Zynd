"use client";

import Image from "next/image";

import digiImage from "../../../../public/digi.png";
import digilockerAddImage from "../../../../public/digilocker-add.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerImageProps = {
  className?: string;
  variant?: "default" | "hero" | "address" | "compact";
};

const IMAGE_BY_VARIANT = {
  address: "mx-auto h-auto w-full max-w-[11rem] object-contain",
  hero: "mx-auto h-auto w-[7.25rem] max-w-full rounded-xl object-contain",
  default: "mx-auto h-auto w-[7.75rem] max-w-full rounded-lg object-contain",
  compact: "size-9 shrink-0 rounded-lg object-contain",
} as const;

export function KycDigilockerImage({ className, variant = "default" }: KycDigilockerImageProps) {
  const src = variant === "address" ? digilockerAddImage : digiImage;

  return (
    <Image
      src={src}
      alt={copy.kyc.digilocker.title}
      className={cn(IMAGE_BY_VARIANT[variant], className)}
      priority
    />
  );
}
