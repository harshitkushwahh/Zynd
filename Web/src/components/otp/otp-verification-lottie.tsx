"use client";

import { KycJsonLottie } from "@/features/kyc/components/kyc-json-lottie";
import { cn } from "@/lib/utils";

export const OTP_VERIFICATION_LOTTIE_SRC = "/otp-verification.json";

type OtpVerificationLottieProps = {
  className?: string;
};

export function OtpVerificationLottie({ className }: OtpVerificationLottieProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <KycJsonLottie
        src={OTP_VERIFICATION_LOTTIE_SRC}
        className="size-[7.25rem] max-h-[7.25rem] max-w-[7.25rem]"
      />
    </div>
  );
}
