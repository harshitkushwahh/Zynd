"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { cn } from "@/lib/utils";

const PAN_CARD_LOTTIE_SRC = "/Pancard.lottie";

type KycPanLottieProps = {
  className?: string;
  variant?: "panel" | "header" | "hero";
};

const PAN_LOTTIE_SIZE_CLASS = {
  header: "max-h-24 max-w-[112px]",
  panel: "max-h-40 max-w-[220px]",
  hero: "max-h-56 max-w-[280px] sm:max-h-64 sm:max-w-[320px]",
} as const;

export function KycPanLottie({ className, variant = "panel" }: KycPanLottieProps) {
  return (
    <div className={className}>
      <DotLottieReact
        src={PAN_CARD_LOTTIE_SRC}
        loop
        autoplay
        className={cn("mx-auto size-full", PAN_LOTTIE_SIZE_CLASS[variant])}
      />
    </div>
  );
}
