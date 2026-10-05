"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycNomineeOptOutIllustration } from "@/features/kyc/components/kyc-nominee-opt-out-illustration";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycNomineeOptOutDialogProps = {
  open: boolean;
  confirming?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
};

export function KycNomineeOptOutDialog({
  open,
  confirming = false,
  onOpenChange,
  onConfirmed,
}: KycNomineeOptOutDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAcknowledged(false);
    setError("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!acknowledged) {
      setError(copy.kyc.nominee.optOut.acknowledgeRequired);
      return;
    }
    if (confirming) return;

    onConfirmed();
    reset();
  };

  const busy = confirming;
  const canConfirm = acknowledged && !busy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        motion="fade"
        showCloseButton
        overlayClassName="kyc-nominee-opt-out-overlay"
        className={cn(
          "kyc-nominee-opt-out-root kyc-dialog-surface kyc-subdialog-surface flex max-h-[min(92vh,52rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-zynd-high ring-1 ring-border/80 sm:max-w-lg",
        )}
      >
        <DialogTitle className="sr-only">{copy.kyc.nominee.optOut.title}</DialogTitle>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 pt-6">
          <KycNomineeOptOutIllustration />

          <div className="space-y-1.5 text-center">
            <h3 className="text-h4 font-semibold text-foreground">{copy.kyc.nominee.optOut.title}</h3>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {copy.kyc.nominee.optOut.description}
            </p>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3.5 transition-colors",
              acknowledged
                ? "border-primary/35 bg-primary/[0.05] shadow-zynd-low ring-1 ring-primary/15"
                : "border-border bg-muted/20 hover:border-border/90 hover:bg-muted/30",
            )}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
                setError("");
              }}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-2 transition-colors",
                acknowledged
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background",
              )}
            >
              {acknowledged ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 space-y-2 text-left">
              <span className="block text-compact font-medium leading-snug text-foreground">
                {copy.kyc.nominee.optOut.acknowledge}
              </span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                {copy.kyc.nominee.optOut.declaration}
              </span>
            </span>
          </label>

          {error ? <FieldMessage message={error} /> : null}
        </div>

        <div className="border-t border-border/80 px-6 py-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {busy ? copy.kyc.saving : copy.kyc.nominee.optOut.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
