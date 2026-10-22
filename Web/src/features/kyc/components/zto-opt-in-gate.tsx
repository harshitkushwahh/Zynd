"use client";

import { useCallback, useEffect, useState } from "react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  isZtoConsentPairValid,
  ZtoSignupConsents,
} from "@/features/kyc/components/zto-signup-consents";
import { notifyZtoFlowStarted } from "@/features/kyc/components/zto-review-gate";
import { fetchZtoFlowStatus, optInZtoFlow } from "@/features/kyc/lib/zto-api";
import { copy } from "@/shared/config/copy";

function dismissKey(userId: string) {
  return `zto-opt-in-dismissed:${userId}`;
}

type ZtoOptInGateProps = {
  enabled?: boolean;
};

/**
 * After login, users who finished signup without ZTO consents see Cybrilla checkboxes once
 * so lookups can still run before the review dialog.
 */
export function ZtoOptInGate({ enabled = true }: ZtoOptInGateProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [bankConsent, setBankConsent] = useState(false);
  const [customerConsent, setCustomerConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let cancelled = false;

    const run = async () => {
      try {
        if (typeof window !== "undefined" && window.localStorage.getItem(dismissKey(user.id))) {
          return;
        }
        const status = await fetchZtoFlowStatus();
        if (cancelled || !status.enabled || status.phase !== "NOT_STARTED") return;
        setOpen(true);
      } catch {
        // Best-effort — never block dashboard.
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id]);

  const handleSkip = useCallback(() => {
    if (user?.id) {
      window.localStorage.setItem(dismissKey(user.id), "1");
    }
    setOpen(false);
  }, [user?.id]);

  const handleContinue = useCallback(async () => {
    if (!isZtoConsentPairValid(bankConsent, customerConsent) || !bankConsent) return;
    setSubmitting(true);
    setError("");
    try {
      await optInZtoFlow(bankConsent, customerConsent);
      notifyZtoFlowStarted();
      setOpen(false);
    } catch {
      setError(copy.zto.optIn.failed);
    } finally {
      setSubmitting(false);
    }
  }, [bankConsent, customerConsent]);

  if (!open) return null;

  const t = copy.zto.optIn;
  const canContinue = bankConsent && customerConsent && isZtoConsentPairValid(bankConsent, customerConsent);

  return (
    <BrandDialog open title={t.title} maxWidth="lg" showCloseButton={false} onOpenChange={() => undefined}>
      <div className="space-y-4 px-6 pb-2">
        <p className="text-caption leading-relaxed text-muted-foreground">{t.description}</p>
        <ZtoSignupConsents
          prefetch
          idPrefix="zto-opt-in"
          bankConsent={bankConsent}
          customerConsent={customerConsent}
          onBankConsentChange={setBankConsent}
          onCustomerConsentChange={setCustomerConsent}
        />
        {error ? <p className="text-caption text-destructive">{error}</p> : null}
      </div>
      <BrandDialogFooter className="border-t border-border/80">
        <Button type="button" variant="ghost" disabled={submitting} onClick={handleSkip}>
          {t.skip}
        </Button>
        <Button type="button" size="auth" disabled={!canContinue || submitting} onClick={() => void handleContinue()}>
          {submitting ? t.submitting : t.continue}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
