"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { cn } from "@/lib/utils";

const AADHAAR_LOTTIE_SRC = "/Aadhar%20card.lottie";

type KycAadhaarLottieProps = {
  className?: string;
  variant?: "panel" | "header" | "hero";
};

const AADHAAR_LOTTIE_SIZE_CLASS = {
  header: "max-h-24 max-w-[112px]",
  panel: "max-h-40 max-w-[220px]",
  hero: "max-h-56 max-w-[280px] sm:max-h-64 sm:max-w-[320px]",
} as const;

export function KycAadhaarLottie({ className, variant = "panel" }: KycAadhaarLottieProps) {
  return (
    <div className={className}>
      <DotLottieReact
        src={AADHAAR_LOTTIE_SRC}
        loop
        autoplay
        className={cn("mx-auto size-full", AADHAAR_LOTTIE_SIZE_CLASS[variant])}
      />
    </div>
  );
}
