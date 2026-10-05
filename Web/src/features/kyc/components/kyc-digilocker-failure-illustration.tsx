"use client";

import Image from "next/image";

import digilockerNotImage from "../../../../public/digilocker-not.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerFailureIllustrationProps = {
  className?: string;
};

export function KycDigilockerFailureIllustration({ className }: KycDigilockerFailureIllustrationProps) {
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <Image
        src={digilockerNotImage}
        alt={copy.kyc.digilocker.failedIllustrationAlt}
        className="h-auto w-full max-w-[17rem] object-contain"
        priority
      />
    </div>
  );
}
