"use client";

import { Info } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundDisclaimerNoticeProps = {
  disclaimer?: string | null;
  distributorArn?: string | null;
  distributorEuin?: string | null;
  className?: string;
};

export function MfFundDisclaimerNotice({
  disclaimer,
  distributorArn,
  distributorEuin,
  className,
}: MfFundDisclaimerNoticeProps) {
  const body = disclaimer?.trim();
  const hasDistributorDetails = Boolean(distributorArn?.trim() || distributorEuin?.trim());

  if (!body && !hasDistributorDetails) return null;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 text-center",
        className,
      )}
      role="note"
      aria-label={copy.mutualFunds.disclaimerTitle}
    >
      <div
        className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted/30 text-muted-foreground"
        aria-hidden="true"
      >
        <Info className="size-4" strokeWidth={2.25} />
      </div>

      <p className="text-caption font-medium text-muted-foreground">{copy.mutualFunds.disclaimerTitle}</p>

      {body ? (
        <p className="mt-2 max-w-prose text-caption leading-relaxed text-muted-foreground/80">{body}</p>
      ) : null}

      {hasDistributorDetails ? (
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground/70">
          {distributorArn?.trim() ? (
            <p>
              {copy.mutualFunds.distributorArn}: {distributorArn}
            </p>
          ) : null}
          {distributorEuin?.trim() ? (
            <p>
              {copy.mutualFunds.distributorEuin}: {distributorEuin}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
