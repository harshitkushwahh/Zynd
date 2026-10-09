"use client";

import Image from "next/image";

const FUNDS_FOR_YOU_RISK_ILLUSTRATION = "/riskpro-funds.png";

export function RecommendFundsRiskAssessmentIllustration() {
  return (
    <div className="rf-risk-illustration rf-risk-illustration-glass" aria-hidden>
      <span className="rf-kyc-illustration-glow" />
      <span className="rf-kyc-illustration-orbit" />

      <Image
        src={FUNDS_FOR_YOU_RISK_ILLUSTRATION}
        alt=""
        width={1536}
        height={1024}
        sizes="(max-width: 768px) 180px, 240px"
        className="rf-risk-illustration-image"
      />
    </div>
  );
}
