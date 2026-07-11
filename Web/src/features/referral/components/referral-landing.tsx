"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { recordReferralClick } from "@/features/referral/api/referral-api";
import { persistReferralCode } from "@/features/referral/lib/referral-storage";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type ReferralLandingProps = {
  code: string;
};

export function ReferralLanding({ code }: ReferralLandingProps) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await recordReferralClick(code);
        if (cancelled) return;
        persistReferralCode(code);
        router.replace("/");
      } catch {
        if (cancelled) return;
        setError(copy.referral.landingInvalid);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <FieldMessage message={error} />
          <Button className="mt-4" onClick={() => router.replace("/")}>
            Go to Zynd
          </Button>
        </>
      ) : (
        <p className="text-compact text-muted-foreground">{copy.referral.landingLoading}</p>
      )}
    </div>
  );
}
