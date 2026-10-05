"use client";

import Image from "next/image";

import optOutNomineeImage from "../../../../public/opt-out-nominee.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycNomineeOptOutIllustrationProps = {
  className?: string;
};

export function KycNomineeOptOutIllustration({ className }: KycNomineeOptOutIllustrationProps) {
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <Image
        src={optOutNomineeImage}
        alt={copy.kyc.nominee.optOut.illustrationAlt}
        className="h-auto w-full max-w-[17rem] object-contain"
        priority
      />
    </div>
  );
}
