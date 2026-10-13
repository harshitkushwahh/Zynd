"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { MfInvestEducationDialog } from "@/features/invest/components/mf-invest-education-dialog";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFolioNominationInfoButtonProps = {
  className?: string;
};

export function MfFolioNominationInfoButton({ className }: MfFolioNominationInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const mfCopy = copy.mutualFunds;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
          className,
        )}
        aria-label={mfCopy.paymentCardFolioNominationInfoAria}
      >
        <Info className="size-4" strokeWidth={2.25} aria-hidden />
      </button>

      <MfInvestEducationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
