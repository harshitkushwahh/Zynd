"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminUserRiskMetaCopyBadgeProps = {
  label: string;
  value: string;
  copyValue?: string;
  mono?: boolean;
  className?: string;
};

export function AdminUserRiskMetaCopyBadge({
  label,
  value,
  copyValue,
  mono = false,
  className,
}: AdminUserRiskMetaCopyBadgeProps) {
  const [copied, setCopied] = useState(false);
  const textToCopy = copyValue ?? value;

  const onCopy = useCallback(async () => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [textToCopy]);

  if (!value || value === "—") return null;

  return (
    <button
      type="button"
      className={cn("admin-user-risk-meta-copy-badge", className)}
      onClick={() => void onCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      <span className="admin-user-risk-meta-copy-badge__label">{label}</span>
      <span className={cn("admin-user-risk-meta-copy-badge__value", mono && "font-mono")}>{value}</span>
      {copied ? (
        <Check className="admin-user-risk-meta-copy-badge__icon" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="admin-user-risk-meta-copy-badge__icon" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
