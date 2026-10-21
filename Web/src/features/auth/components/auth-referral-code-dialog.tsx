"use client";

import { useCallback, useState } from "react";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

function normalizeReferralDraft(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
}

type AuthReferralCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string;
  isLoginMode: boolean;
  onApply: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function AuthReferralCodeDialog({
  open,
  onOpenChange,
  initialCode = "",
  isLoginMode,
  onApply,
}: AuthReferralCodeDialogProps) {
  const [draft, setDraft] = useState(initialCode);
  const [error, setError] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const reset = useCallback(() => {
    setDraft(initialCode);
    setError("");
  }, [initialCode]);

  useResetWhenDialogOpens(open, reset);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoginMode) {
      setError(copy.auth.referralExistingUserError);
      return;
    }
    setIsApplying(true);
    setError("");
    try {
      const result = await onApply(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        centeredLayout
        layoutWrapperClassName="auth-referral-dialog-layer pointer-events-none"
        overlayClassName="auth-referral-dialog-overlay backdrop-zynd-overlay"
        className={cn(
          "auth-referral-dialog-layer relative w-[min(100%,22.5rem)] max-w-[22.5rem] gap-0 overflow-hidden rounded-[var(--radius-modal)]",
          "bg-popover p-0 shadow-zynd-high ring-1 ring-border/80",
        )}
        showCloseButton
      >
        <DialogTitle className="sr-only">{copy.auth.referralDialogTitle}</DialogTitle>

        <form className="flex flex-col px-6 pb-7 pt-8 text-center sm:px-7 sm:pb-8 sm:pt-9" onSubmit={handleSubmit}>
          <div className="mx-auto mb-5 flex size-[4.5rem] items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary shadow-zynd-low ring-1 ring-primary/10">
            <Gift className="size-9" strokeWidth={1.65} aria-hidden />
          </div>

          <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground">
            {copy.auth.referralDialogTitle}
          </h2>

          <div className="mt-5 space-y-3 text-left">
            {!error ? (
              <p className="text-center text-caption leading-relaxed text-muted-foreground">
                {copy.auth.referralCodeFormatHint}
              </p>
            ) : null}
            <Input
              type="text"
              name="referral_code"
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.auth.referralCodePlaceholder}
              value={draft}
              onChange={(event) => {
                setDraft(normalizeReferralDraft(event.target.value));
                if (error) setError("");
              }}
              aria-invalid={!!error}
              className="h-11 rounded-[0.75rem] border-border/80 bg-muted/25 px-3.5 text-center font-mono text-compact tracking-[0.12em] uppercase shadow-zynd-low placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus-visible:bg-background"
              maxLength={16}
              autoFocus
              disabled={isApplying}
            />
            {error ? <FieldMessage message={error} className="text-center" /> : null}
          </div>

          <Button
            type="submit"
            size="auth"
            className="mt-5 w-full rounded-[0.75rem]"
            disabled={!draft.trim() || isApplying}
          >
            {isApplying ? copy.auth.referralDialogApplying : copy.auth.referralDialogApply}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
