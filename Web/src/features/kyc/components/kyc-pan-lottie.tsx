"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const PAN_CARD_LOTTIE_SRC = "/Pancard.lottie";

type KycPanLottieProps = {
  className?: string;
};

export function KycPanLottie({ className }: KycPanLottieProps) {
  return (
    <div className={className}>
      <DotLottieReact
        src={PAN_CARD_LOTTIE_SRC}
        loop
        autoplay
        className="mx-auto size-full max-h-40 max-w-[220px]"
      />
    </div>
  );
}
