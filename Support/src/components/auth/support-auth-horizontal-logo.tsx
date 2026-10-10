"use client";

import Image from "next/image";

import { useTheme } from "@/contexts/theme-context";
import {
  ZYND_SUPPORT_LOGO_HORIZONTAL_DARK_SRC,
  ZYND_SUPPORT_LOGO_HORIZONTAL_SRC,
} from "@/lib/support-brand-assets";
import { cn } from "@/lib/utils";

export function SupportAuthHorizontalLogo({ className }: { className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={cn("support-login-page__logo-wrap support-login-page__logo--horizontal", className)}
    >
      <Image
        src={ZYND_SUPPORT_LOGO_HORIZONTAL_SRC}
        alt=""
        fill
        sizes="(max-width: 768px) 70vw, 18rem"
        className={cn("support-login-page__logo--theme", isDark ? "opacity-0" : "opacity-100")}
        priority
        aria-hidden={isDark}
      />
      <Image
        src={ZYND_SUPPORT_LOGO_HORIZONTAL_DARK_SRC}
        alt=""
        fill
        sizes="(max-width: 768px) 70vw, 18rem"
        className={cn("support-login-page__logo--theme", isDark ? "opacity-100" : "opacity-0")}
        priority
        aria-hidden={!isDark}
      />
      <span className="sr-only">ZYND Support</span>
    </div>
  );
}
