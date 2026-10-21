"use client";

import Image from "next/image";
import Link from "next/link";

import { useTheme } from "@/contexts/theme-context";
import { APP_NAME } from "@/shared/config/brand";
import { cn } from "@/lib/utils";

export const LANDING_LOGO_LIGHT_SRC = "/hori.png";
export const LANDING_LOGO_DARK_SRC = "/hori-dark.png";

type LandingLogoProps = {
  className?: string;
  priority?: boolean;
};

export function LandingLogo({ className, priority = false }: LandingLogoProps) {
  const { theme } = useTheme();
  const src = theme === "dark" ? LANDING_LOGO_DARK_SRC : LANDING_LOGO_LIGHT_SRC;

  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex shrink-0 items-center transition-opacity hover:opacity-90",
        className,
      )}
    >
      <Image
        key={src}
        src={src}
        alt={APP_NAME}
        width={128}
        height={32}
        className="h-[1.375rem] w-auto max-w-[6.75rem] object-contain sm:h-6 sm:max-w-[7rem]"
        priority={priority}
      />
    </Link>
  );
}
