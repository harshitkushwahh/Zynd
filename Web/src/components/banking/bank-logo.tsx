"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";

import {
  parseBankNameFromAccountLabel,
  resolveIndianBankLogoUrl,
} from "@/shared/lib/indian-bank-logo";
import { cn } from "@/lib/utils";

type BankLogoSize = "sm" | "md" | "lg";

type BankLogoProps = {
  bankName?: string | null;
  ifscCode?: string | null;
  /** Fallback when bank name is embedded in a masked account label. */
  accountLabel?: string | null;
  size?: BankLogoSize;
  variant?: "standard" | "horizontal";
  className?: string;
  fallbackClassName?: string;
};

const SIZE_CLASS: Record<
  BankLogoSize,
  { wrap: string; icon: string; img: string }
> = {
  sm: { wrap: "size-9", icon: "size-3.5", img: "size-7" },
  md: { wrap: "size-10", icon: "size-4", img: "size-8" },
  lg: { wrap: "size-8", icon: "size-3.5", img: "size-6" },
};

export function BankLogo({
  bankName,
  ifscCode,
  accountLabel,
  size = "md",
  variant = "standard",
  className,
  fallbackClassName,
}: BankLogoProps) {
  const [failed, setFailed] = useState(false);
  const resolvedBankName = bankName?.trim() || parseBankNameFromAccountLabel(accountLabel);
  const logoUrl = useMemo(
    () =>
      resolveIndianBankLogoUrl({
        bankName: resolvedBankName,
        ifscCode,
        variant,
      }),
    [ifscCode, resolvedBankName, variant],
  );
  const sizeClass = SIZE_CLASS[size];

  if (!logoUrl || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15",
          sizeClass.wrap,
          fallbackClassName,
          className,
        )}
        aria-hidden
      >
        <Building2 className={sizeClass.icon} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/70",
        sizeClass.wrap,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className={cn("object-contain p-0.5", sizeClass.img)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
