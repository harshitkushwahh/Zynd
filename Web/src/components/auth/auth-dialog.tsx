"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuthDialogSteps } from "@/features/auth/components/auth-dialog-steps";
import { AuthDialogFlowProvider } from "@/features/auth/hooks/auth-dialog-flow";
import { ZyndErrorBoundary } from "@/shared/components/zynd-error-boundary";
import { copy } from "@/shared/config/copy";

export function AuthDialog() {
  const [open, setOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFlowKey((current) => current + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>Login / Signup</DialogTrigger>
      <DialogContent
        showCloseButton
        className="grid w-full max-w-[860px] overflow-hidden sm:max-w-[860px]"
      >
        <DialogTitle className="sr-only">{copy.auth.dialogSrTitle}</DialogTitle>
        <AuthDialogFlowProvider
          key={flowKey}
          onClose={() => {
            setOpen(false);
          }}
        >
          <ZyndErrorBoundary variant="inline" onReset={() => setFlowKey((current) => current + 1)}>
            <AuthDialogSteps />
          </ZyndErrorBoundary>
        </AuthDialogFlowProvider>
      </DialogContent>
    </Dialog>
  );
}
