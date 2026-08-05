"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type AddInvestorEsignPanelProps = {
  done: boolean;
  onSign: () => void;
};

export function AddInvestorEsignPanel({ done, onSign }: AddInvestorEsignPanelProps) {
  return (
    <div className="add-investor-onboarding-wizard__center add-investor-esign-panel">
      <div className="add-investor-esign-panel__image-wrap">
        <Image
          src="/Aadhaar.webp"
          alt="Aadhaar"
          width={160}
          height={64}
          className="add-investor-esign-panel__image"
          priority
        />
      </div>

      <h3 className="add-investor-onboarding-wizard__title">Aadhaar OTP e-sign</h3>
      <p className="add-investor-esign-panel__desc">
        New-to-KYC investors complete Aadhaar OTP e-sign on the onboarding pack (demo only).
      </p>

      <div className="add-investor-esign-panel__actions">
        <Button
          type="button"
          className="add-investor-esign-panel__button"
          disabled={done}
          onClick={onSign}
        >
          {done ? "E-sign completed" : "Sign with Aadhaar OTP"}
        </Button>

        {done ? (
          <p className="add-investor-esign-panel__success">
            <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden />
            E-sign captured — continue to review your details.
          </p>
        ) : null}
      </div>
    </div>
  );
}
