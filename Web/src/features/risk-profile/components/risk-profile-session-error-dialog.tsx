"use client";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { copy } from "@/shared/config/copy";

export type RiskProfileSessionErrorKind = "locked" | "discarded";

type RiskProfileSessionErrorDialogProps = {
  open: boolean;
  kind: RiskProfileSessionErrorKind;
  onDone: () => void;
};

export function RiskProfileSessionErrorDialog({
  open,
  kind,
  onDone,
}: RiskProfileSessionErrorDialogProps) {
  if (kind === "discarded") {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={() => {
          // Blocking dialog — only the primary action dismisses.
        }}
        variant="info"
        title={copy.riskProfile.sessionDiscardedTitle}
        description={copy.riskProfile.sessionDiscardedDescription}
        doneLabel={copy.riskProfile.backAction}
        onConfirm={onDone}
      />
    );
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={() => {
        // Blocking dialog — only the primary action dismisses.
      }}
      title={copy.riskProfile.lockedAttemptsTitle}
      maxWidth="md"
      showCloseButton={false}
    >
      <BrandDialogFooter>
        <Button type="button" className="min-w-[8.5rem]" onClick={onDone}>
          {copy.riskProfile.backAction}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
