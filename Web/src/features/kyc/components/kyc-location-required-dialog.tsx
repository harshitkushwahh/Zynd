"use client";

import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type KycLocationRequiredDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string | null;
  loading?: boolean;
  onRequestLocation: () => void;
};

export function KycLocationRequiredDialog({
  open,
  onOpenChange,
  error,
  loading = false,
  onRequestLocation,
}: KycLocationRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[60] max-w-sm gap-0 overflow-hidden p-0"
        overlayClassName="z-[60]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{copy.kyc.location.title}</DialogTitle>

        <div className="flex flex-col items-center px-6 py-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="size-6" strokeWidth={2.25} />
          </div>

          <h3 className="mt-4 text-h4 font-semibold text-foreground">{copy.kyc.location.title}</h3>
          <p className="mt-2 max-w-sm text-caption leading-relaxed text-muted-foreground">
            {copy.kyc.location.description}
          </p>

          {error ? (
            <div className="mt-4 w-full text-left">
              <FieldMessage message={error} />
            </div>
          ) : null}

          <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="sm:min-w-[7rem]"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {copy.kyc.location.cancel}
            </Button>
            <Button
              type="button"
              className="sm:min-w-[7rem]"
              onClick={onRequestLocation}
              disabled={loading}
            >
              {loading ? copy.kyc.location.requesting : copy.kyc.location.enable}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
