"use client";

import Image from "next/image";

import digiImage from "../../../../public/digi.png";
import { copy } from "@/shared/config/copy";

type KycDigilockerImageProps = {
  className?: string;
};

export function KycDigilockerImage({ className }: KycDigilockerImageProps) {
  return (
    <div className={className}>
      <Image
        src={digiImage}
        alt={copy.kyc.digilocker.title}
        className="mx-auto max-h-32 max-w-[200px] object-contain"
        priority
      />
    </div>
  );
}
