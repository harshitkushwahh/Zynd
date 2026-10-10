"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

type ClientCodeCopyBadgeProps = {
  clientCode: string;
  className?: string;
};

export function ClientCodeCopyBadge({ clientCode, className }: ClientCodeCopyBadgeProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clientCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [clientCode]);

  return (
    <button
      type="button"
      className={cn("distributor-profile-hero-card__badge distributor-profile-hero-card__badge--copy", className)}
      onClick={() => void onCopy()}
      aria-label={copied ? "Client code copied" : `Copy client code ${clientCode}`}
    >
      <span className="distributor-profile-hero-card__badge-code">{clientCode}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
