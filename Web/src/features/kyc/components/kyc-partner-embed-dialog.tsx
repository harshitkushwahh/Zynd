"use client";

import { Loader2, X } from "lucide-react";

import { KycAadhaarLottie } from "@/features/kyc/components/kyc-aadhaar-lottie";
import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type KycPartnerEmbedKind = "digilocker" | "esign";

type KycPartnerEmbedDialogProps = {
  open: boolean;
  kind: KycPartnerEmbedKind;
  popupBlocked: boolean;
  submittingApplication?: boolean;
  onClose: () => void;
  onReopenPopup: () => void;
  onOpenFullWindow: () => void;
};

function titleForKind(kind: KycPartnerEmbedKind): string {
  return kind === "digilocker" ? copy.kyc.partnerEmbed.digilockerTitle : copy.kyc.partnerEmbed.esignTitle;
}

export function KycPartnerEmbedDialog({
  open,
  kind,
  popupBlocked,
  submittingApplication = false,
  onClose,
  onReopenPopup,
  onOpenFullWindow,
}: KycPartnerEmbedDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        centeredLayout
        layoutWrapperClassName="z-[86]"
        overlayClassName="kyc-partner-embed-overlay"
        motion="fade"
        showCloseButton={false}
        className={cn(
          "kyc-partner-embed-root kyc-dialog-surface relative z-[85] mx-auto flex w-[min(98vw,30rem)] max-w-[min(98vw,30rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-zynd-high ring-1 ring-border/80",
          kind === "digilocker"
            ? "bg-gradient-to-b from-primary/[0.07] via-card to-card"
            : "bg-gradient-to-b from-muted/30 via-card to-card",
        )}
      >
        <DialogTitle className="sr-only">{titleForKind(kind)}</DialogTitle>

        {!submittingApplication ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-label={copy.kyc.partnerEmbed.close}
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div className="flex flex-col items-center gap-4 px-6 pb-2 pt-8 text-center">
          {kind === "digilocker" ? (
            <KycDigilockerImage variant="hero" />
          ) : (
            <KycAadhaarLottie className="flex justify-center" />
          )}

          <div className="max-w-[22rem] space-y-2">
            {submittingApplication ? (
              <>
                <div className="flex items-center justify-center gap-2 text-body font-medium text-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <span>{copy.kyc.partnerEmbed.submittingApplication}</span>
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.kyc.partnerEmbed.popupHint}
                </p>
              </>
            ) : !popupBlocked ? (
              <>
                <div className="flex items-center justify-center gap-2 text-body font-medium text-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <span>{copy.kyc.partnerEmbed.waitingInPopup}</span>
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {copy.kyc.partnerEmbed.popupHint}
                </p>
              </>
            ) : (
              <p className="text-caption leading-relaxed text-muted-foreground">
                {copy.kyc.partnerEmbed.popupBlockedHint}
              </p>
            )}
          </div>
        </div>

        {!submittingApplication ? (
          <div className="flex shrink-0 flex-row gap-2 px-5 pb-5 pt-3">
            <Button type="button" className="min-h-10 flex-1" variant="default" onClick={onReopenPopup}>
              {copy.kyc.partnerEmbed.reopenPopup}
            </Button>
            <Button type="button" className="min-h-10 flex-1" variant="outline" onClick={onOpenFullWindow}>
              {copy.kyc.partnerEmbed.openFullWindow}
            </Button>
          </div>
        ) : (
          <div className="pb-5" />
        )}
      </DialogContent>
    </Dialog>
  );
}
