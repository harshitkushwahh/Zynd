"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";

type ClientKycPartnerRefCopyProps = {
  partnerRef: string;
  className?: string;
};

export function ClientKycPartnerRefCopy({ partnerRef, className }: ClientKycPartnerRefCopyProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(partnerRef);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [partnerRef]);

  return (
    <div className={cn("support-client-kyc-verification-status__ref-block", className)}>
      <span className="support-client-kyc-verification-status__ref-label">{copy.verificationRefLabel}</span>
      <button
        type="button"
        className="support-client-kyc-verification-status__ref-box"
        onClick={() => void onCopy()}
        aria-label={copied ? copy.verificationRefCopied : copy.copyVerificationRef(partnerRef)}
      >
        <code className="support-client-kyc-verification-status__ref-value">{partnerRef}</code>
        {copied ? (
          <Check className="size-3.5 shrink-0 text-success" strokeWidth={2.25} aria-hidden />
        ) : (
          <Copy className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
        )}
      </button>
    </div>
  );
}
