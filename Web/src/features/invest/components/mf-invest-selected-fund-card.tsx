"use client";

import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MF_INVEST_PAYMENT_CARD_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfInvestSelectedFundCardProps = {
  fundName?: string | null;
  amcLogoUrl?: string | null;
  amcName?: string | null;
  amcSlug?: string | null;
  selected?: boolean;
  className?: string;
};

export function MfInvestSelectedFundCard({
  fundName,
  amcLogoUrl,
  amcName,
  amcSlug,
  selected = false,
  className,
}: MfInvestSelectedFundCardProps) {
  const hasFund = Boolean(fundName?.trim());
  const title = fundName?.trim() || copy.mutualFunds.paymentCardFundPlaceholder;
  const amcLabel = amcName?.trim() || "AMC";

  return (
    <div
      className={cn(
        MF_INVEST_PAYMENT_CARD_CLASS,
        "flex min-w-0 items-start gap-3 px-4 py-3",
        selected && hasFund
          ? "border-dashed border-primary/35 bg-primary/[0.03]"
          : "border-dashed border-border/80 bg-muted/10",
        className,
      )}
    >
      {hasFund ? (
        <MfFundAmcAvatar
          amcLogoUrl={amcLogoUrl ?? null}
          amcName={amcLabel}
          amcSlug={amcSlug}
          size="md"
          className="mt-0.5"
        />
      ) : (
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border/70 bg-muted/20 text-[10px] font-semibold text-muted-foreground/70"
          aria-hidden
        >
          —
        </div>
      )}
      <p
        className={cn(
          "min-w-0 flex-1 line-clamp-3 text-compact font-semibold leading-snug",
          hasFund ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </p>
    </div>
  );
}
