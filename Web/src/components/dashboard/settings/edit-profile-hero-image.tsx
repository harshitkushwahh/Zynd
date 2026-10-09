"use client";

import Image from "next/image";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const EDIT_PROFILE_HERO_SIZES = "(max-width: 768px) 280px, 360px";

type EditProfileHeroImageProps = {
  className?: string;
};

export function EditProfileHeroImage({ className }: EditProfileHeroImageProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/profile-details.png"
        alt={copy.settings.editProfileTitle}
        width={1536}
        height={1024}
        sizes={EDIT_PROFILE_HERO_SIZES}
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
