"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuthReferralCodeDialogHost } from "@/features/auth/components/auth-referral-code-dialog-host";
import { AuthDialogSteps } from "@/features/auth/components/auth-dialog-steps";
import { AuthDialogFlowProvider } from "@/features/auth/hooks/auth-dialog-flow";
import { ZyndErrorBoundary } from "@/shared/components/zynd-error-boundary";
import { copy } from "@/shared/config/copy";

type AuthDialogSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggers?: ReactNode;
};

export function AuthDialogSurface({
  open,
  onOpenChange,
  triggers,
}: AuthDialogSurfaceProps) {
  const [flowKey, setFlowKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFlowKey((current) => current + 1);
    }
  };

  return (
    <AuthDialogFlowProvider
      key={flowKey}
      surfaceOpen={open}
      onClose={() => {
        onOpenChange(false);
      }}
    >
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {triggers}
        <DialogContent
          showCloseButton
          overlayClassName="z-[80]"
          className="z-[80] grid w-full max-w-[min(100%,28rem)] gap-0 overflow-visible rounded-[var(--radius-modal)] p-0 shadow-zynd-high ring-1 ring-border/80 sm:max-w-[28rem]"
        >
          <DialogTitle className="sr-only">{copy.auth.dialogSrTitle}</DialogTitle>
          <ZyndErrorBoundary variant="inline" onReset={() => setFlowKey((current) => current + 1)}>
            <AuthDialogSteps />
          </ZyndErrorBoundary>
        </DialogContent>
      </Dialog>
      <AuthReferralCodeDialogHost />
    </AuthDialogFlowProvider>
  );
}

type AuthDialogProps = {
  /** Custom trigger element; defaults to a standard login button. */
  trigger?: ReactElement;
  defaultTriggerLabel?: string;
};

export function AuthDialog({
  trigger,
  defaultTriggerLabel = "Login / Signup",
}: AuthDialogProps = {}) {
  const [open, setOpen] = useState(false);

  return (
    <AuthDialogSurface
      open={open}
      onOpenChange={setOpen}
      triggers={
        <DialogTrigger
          render={trigger ?? <Button className="shadow-zynd-mid" />}
        >
          {trigger ? null : defaultTriggerLabel}
        </DialogTrigger>
      }
    />
  );
}
