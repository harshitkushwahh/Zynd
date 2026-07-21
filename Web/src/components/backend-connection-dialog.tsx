"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripeProgressBar } from "@/components/ui/stripe-progress-bar";
import { APP_NAME } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type BackendConnectionDialogProps = {
  open: boolean;
};

export function BackendConnectionDialog({ open }: BackendConnectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "z-[100] max-w-sm overflow-hidden p-0",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
        )}
        overlayClassName="z-[100]"
      >
        <DialogTitle className="sr-only">{copy.backendConnection.title}</DialogTitle>

        <div className="flex flex-col items-center gap-5 px-6 py-7 text-center">
          <div className="flex size-16 items-center justify-center rounded-[var(--radius-card)] bg-muted/50 p-2 ring-1 ring-border">
            <Image
              src="/logo.png"
              alt={APP_NAME}
              width={48}
              height={48}
              className="size-12 object-contain"
              priority
            />
          </div>

          <div className="max-w-xs space-y-2">
            <p className="text-body font-semibold text-foreground">{copy.backendConnection.title}</p>
            <p className="text-caption leading-relaxed text-muted-foreground">
              {copy.backendConnection.description}
            </p>
          </div>

          <StripeProgressBar
            className="w-full"
            label={copy.backendConnection.progressLabel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
