"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycCybrillaBankManualDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KycCybrillaBankManualDialog({
  open,
  onOpenChange,
}: KycCybrillaBankManualDialogProps) {
  const text = copy.kyc.bank.cybrillaManualDialog;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        motion="fade"
        showCloseButton
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface kyc-info-dialog-surface z-[60] max-w-md overflow-hidden rounded-[2rem] p-0 shadow-zynd-high ring-1 ring-info/35 sm:max-w-md sm:rounded-[2.25rem]",
        )}
      >
        <DialogTitle className="sr-only">{text.title}</DialogTitle>

        <div className="px-6 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative w-full max-w-[200px]">
              <Image
                src="/cybrilla-manaul.png"
                alt=""
                width={400}
                height={260}
                className="h-auto w-full object-contain"
                priority
              />
              <div className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-card shadow-zynd-low ring-1 ring-border">
                <Image
                  src="/partners/cybrilla-icon.png"
                  alt="Cybrilla"
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                />
              </div>
            </div>

            <div className="w-full max-w-sm space-y-2.5">
              <p className="text-body font-semibold tracking-tight text-foreground">{text.title}</p>
              <p className="text-caption leading-relaxed text-muted-foreground">{text.description}</p>
            </div>

            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              {text.continue}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
