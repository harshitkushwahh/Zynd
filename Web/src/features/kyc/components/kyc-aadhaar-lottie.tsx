"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const AADHAAR_LOTTIE_SRC = "/Aadhar%20card.lottie";

type KycAadhaarLottieProps = {
  className?: string;
};

export function KycAadhaarLottie({ className }: KycAadhaarLottieProps) {
  return (
    <div className={className}>
      <DotLottieReact
        src={AADHAAR_LOTTIE_SRC}
        loop
        autoplay
        className="mx-auto size-full max-h-40 max-w-[220px]"
      />
    </div>
  );
}
