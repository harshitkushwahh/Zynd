"use client";

import Image from "next/image";

const FUNDS_FOR_YOU_KYC_ILLUSTRATION = "/kyc-glass.png";

export function RecommendFundsKycIllustration() {
  return (
    <div className="rf-kyc-illustration rf-kyc-illustration-glass" aria-hidden>
      <span className="rf-kyc-illustration-glow" />
      <span className="rf-kyc-illustration-orbit" />

      <Image
        src={FUNDS_FOR_YOU_KYC_ILLUSTRATION}
        alt=""
        width={1789}
        height={879}
        className="rf-kyc-illustration-image"
        priority
      />
    </div>
  );
}
