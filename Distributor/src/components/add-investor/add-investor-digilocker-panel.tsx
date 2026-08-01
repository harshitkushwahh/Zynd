"use client";

import Image from "next/image";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type AddInvestorDigilockerPanelProps = {
  loading: boolean;
  done: boolean;
  onConnect: () => void;
};

export function AddInvestorDigilockerPanel({
  loading,
  done,
  onConnect,
}: AddInvestorDigilockerPanelProps) {
  return (
    <div className="add-investor-onboarding-wizard__center add-investor-digilocker-panel">
      <div className="add-investor-digilocker-panel__image-wrap">
        <Image
          src="/digi.png"
          alt="DigiLocker"
          width={160}
          height={64}
          className="add-investor-digilocker-panel__image"
          priority
        />
      </div>

      <h3 className="add-investor-onboarding-wizard__title">DigiLocker</h3>
      <p className="add-investor-digilocker-panel__desc">
        Demo flow simulates redirect and prefills permanent address from Aadhaar.
      </p>

      <div className="add-investor-digilocker-panel__actions">
        <Button
          type="button"
          className="add-investor-digilocker-panel__button"
          disabled={loading || done}
          onClick={onConnect}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Connecting…
            </>
          ) : done ? (
            "DigiLocker connected"
          ) : (
            "Continue with DigiLocker"
          )}
        </Button>

        {done ? (
          <p className="add-investor-digilocker-panel__success">
            <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden />
            Aadhaar fetched — continue to address review.
          </p>
        ) : null}
      </div>
    </div>
  );
}
