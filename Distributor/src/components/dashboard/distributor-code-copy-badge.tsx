"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Hash } from "lucide-react";

import { cn } from "@/lib/utils";

import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type DistributorCodeCopyBadgeProps = {
  distributorCode: string;
  className?: string;
  /** `hero` — pill on the dashboard photo card; `inline` — copy row on accent identity cards; `menu` — account dropdown row. */
  placement?: "hero" | "inline" | "menu";
};

export function DistributorCodeCopyBadge({
  distributorCode,
  className,
  placement = "hero",
}: DistributorCodeCopyBadgeProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(distributorCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [distributorCode]);

  if (placement === "menu") {
    return (
      <button
        type="button"
        className={cn("distributor-account-menu__code-row", className)}
        onClick={() => void onCopy()}
        aria-label={
          copied ? ZYND_MITRA_COPY.mitraCodeCopied : ZYND_MITRA_COPY.copyMitraCode(distributorCode)
        }
      >
        <span className="distributor-account-menu__meta-icon" aria-hidden>
          <Hash strokeWidth={2.25} className="size-3.5" />
        </span>
        <span className="distributor-account-menu__meta-copy">
          <span className="distributor-account-menu__meta-label">{ZYND_MITRA_COPY.mitraCode}</span>
          <span className="distributor-account-menu__meta-value font-mono tracking-wide">
            {distributorCode}
          </span>
        </span>
        <span className="distributor-account-menu__code-copy" aria-hidden>
          {copied ? (
            <Check strokeWidth={2.5} className="size-3.5 text-success" />
          ) : (
            <Copy strokeWidth={2.25} className="size-3.5" />
          )}
        </span>
      </button>
    );
  }

  if (placement === "inline") {
    return (
      <button
        type="button"
        className={cn("distributor-client-personal-info-account__contact-row", className)}
        onClick={() => void onCopy()}
        aria-label={
          copied ? ZYND_MITRA_COPY.mitraCodeCopied : ZYND_MITRA_COPY.copyMitraCode(distributorCode)
        }
      >
        <span className="distributor-client-personal-info-account__contact-icon" aria-hidden>
          <Hash strokeWidth={2.25} className="size-3.5" />
        </span>
        <span className="distributor-client-personal-info-account__contact-copy">
          <span className="distributor-client-personal-info-account__contact-value font-mono tracking-wide">
            {distributorCode}
          </span>
        </span>
        <span className="distributor-client-personal-info-account__contact-copy-action" aria-hidden>
          {copied ? (
            <Check
              strokeWidth={2.5}
              className="size-3.5 distributor-client-personal-info-account__contact-copy-icon--success"
            />
          ) : (
            <Copy strokeWidth={2.25} className="size-3.5" />
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "distributor-profile-hero-card__badge distributor-profile-hero-card__badge--copy",
        className,
      )}
      onClick={() => void onCopy()}
      aria-label={copied ? ZYND_MITRA_COPY.mitraCodeCopied : ZYND_MITRA_COPY.copyMitraCode(distributorCode)}
    >
      <span className="distributor-profile-hero-card__badge-code">{distributorCode}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
