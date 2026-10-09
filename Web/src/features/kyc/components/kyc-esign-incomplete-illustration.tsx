"use client";

import Image from "next/image";

import aadhaarEsignNotImage from "../../../../public/aadhar-esgin-not.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycEsignIncompleteIllustrationProps = {
  className?: string;
};

export function KycEsignIncompleteIllustration({ className }: KycEsignIncompleteIllustrationProps) {
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <Image
        src={aadhaarEsignNotImage}
        alt={copy.kyc.esign.incompleteIllustrationAlt}
        className="h-auto w-full max-w-[17rem] object-contain"
      />
    </div>
  );
}
