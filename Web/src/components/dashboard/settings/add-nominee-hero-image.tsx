"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ADD_NOMINEE_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type AddNomineeHeroImageProps = {
  className?: string;
};

export function AddNomineeHeroImage({ className }: AddNomineeHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/nominee-add.png"
        alt={copy.settings.nomineesAddTitle}
        width={1536}
        height={1024}
        sizes={ADD_NOMINEE_HERO_SIZES}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
