"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronDown, Keyboard, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VerticalDialPicker } from "@/components/ui/vertical-dial-picker";
import {
  SIP_ORDER_DIAL_MAX_INSTALLMENTS,
  SIP_ORDER_MIN_INSTALLMENTS,
  clampOrderInstallments,
  formatInstallmentDialHeroSecondary,
} from "@/features/invest/lib/mf-sip-calculator";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function InstallmentDialHero({ value }: { value: number }) {
  const secondary = formatInstallmentDialHeroSecondary(value);

  return (
    <div className="flex h-10 items-center justify-center gap-3">
      <p className="w-[4.75rem] text-center text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
        {value}
        <span className="ml-1 text-sm font-semibold text-foreground/70">mo</span>
      </p>
      <div className="h-8 w-px shrink-0 bg-border/70" aria-hidden />
      <p className="min-w-[5.75rem] text-center text-compact font-medium tabular-nums text-muted-foreground">
        {secondary}
      </p>
    </div>
  );
}

function syncInstallmentDraft(
  next: number,
  setHeroValue: (value: number) => void,
  setDraftValue: (value: number) => void,
  setManualText: (value: string) => void,
  pendingDraftRef: React.MutableRefObject<number>,
) {
  const clamped = clampOrderInstallments(next);
  pendingDraftRef.current = clamped;
  setHeroValue(clamped);
  setDraftValue(Math.min(clamped, SIP_ORDER_DIAL_MAX_INSTALLMENTS));
  setManualText(String(clamped));
}

export function MfSipInstallmentsInput({
  value,
  onChange,
  disabled,
  error,
  compact = false,
  compactDisplay = "value",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string | null;
  compact?: boolean;
  compactDisplay?: "value" | "labeled";
}) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [heroValue, setHeroValue] = useState(value);
  const [draftValue, setDraftValue] = useState(value);
  const [manualText, setManualText] = useState(String(value));
  const pendingDraftRef = useRef(value);

  const handleDialPreview = useCallback((next: number) => {
    syncInstallmentDraft(
      next,
      setHeroValue,
      setDraftValue,
      setManualText,
      pendingDraftRef,
    );
  }, []);

  const handleDialCommit = useCallback((next: number) => {
    syncInstallmentDraft(
      next,
      setHeroValue,
      setDraftValue,
      setManualText,
      pendingDraftRef,
    );
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const clamped = clampOrderInstallments(value);
      pendingDraftRef.current = clamped;
      setHeroValue(clamped);
      setDraftValue(Math.min(clamped, SIP_ORDER_DIAL_MAX_INSTALLMENTS));
      setManualText(String(clamped));
      setManualOpen(clamped > SIP_ORDER_DIAL_MAX_INSTALLMENTS);
    } else {
      setManualOpen(false);
    }
    setOpen(nextOpen);
  }

  function handleDone() {
    onChange(clampOrderInstallments(pendingDraftRef.current));
    setOpen(false);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.target instanceof HTMLInputElement) {
      handleDone();
      return;
    }
    event.preventDefault();
    handleDone();
  }

  function handleManualInput(rawValue: string) {
    const digits = rawValue.replace(/[^\d]/g, "");
    setManualText(digits);
    if (!digits) return;

    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return;

    syncInstallmentDraft(
      parsed,
      setHeroValue,
      setDraftValue,
      setManualText,
      pendingDraftRef,
    );
  }

  function toggleManualEntry() {
    setManualOpen((current) => !current);
  }

  function formatCompactValue() {
    if (compact && compactDisplay === "labeled") {
      return `${copy.mutualFunds.sipInstallmentsLabel} · ${value} mo`;
    }
    return `${value} mo`;
  }

  const dialValue = Math.min(
    Math.max(draftValue, SIP_ORDER_MIN_INSTALLMENTS),
    SIP_ORDER_DIAL_MAX_INSTALLMENTS,
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleOpenChange(true)}
        aria-label={
          compact && compactDisplay === "labeled"
            ? `${copy.mutualFunds.sipInstallmentsLabel}, ${value} months`
            : undefined
        }
        className={cn(
          "flex min-h-10 w-full items-center rounded-[var(--radius-card)] border border-border/80 bg-muted/15 py-2 text-left transition-colors hover:bg-muted/25 disabled:pointer-events-none disabled:opacity-50",
          compact ? "justify-between gap-1.5 px-2.5" : "gap-2.5 px-3",
          error && "border-destructive/40",
        )}
      >
        {!compact ? (
          <Repeat2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-compact font-medium tabular-nums text-foreground",
            compact && compactDisplay === "value" && "text-center",
          )}
        >
          {formatCompactValue()}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[17.5rem]"
          showCloseButton
          motion="fade"
        >
          <DialogTitle className="sr-only">
            {copy.mutualFunds.paymentCardInstallmentsLabel}
          </DialogTitle>

          <div className="px-4 pb-4 pt-4" onKeyDown={handleDialogKeyDown}>
            <InstallmentDialHero value={heroValue} />

            <div className="mt-3 min-w-0 overflow-hidden rounded-2xl bg-muted/20 px-2 py-2">
              <VerticalDialPicker
                variant="dialog"
                min={SIP_ORDER_MIN_INSTALLMENTS}
                max={SIP_ORDER_DIAL_MAX_INSTALLMENTS}
                value={dialValue}
                onPreviewChange={handleDialPreview}
                onChange={handleDialCommit}
                formatItem={(item) => `${item} mo`}
                ariaLabel={copy.mutualFunds.paymentCardInstallmentsLabel}
              />
            </div>

            {manualOpen ? (
              <div className="relative mt-3">
                <Input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  aria-label={copy.mutualFunds.paymentCardInstallmentsLabel}
                  placeholder={copy.mutualFunds.sipInstallmentsManualPlaceholder}
                  value={manualText}
                  maxLength={3}
                  onChange={(event) => handleManualInput(event.target.value)}
                  className="h-10 rounded-2xl border-border/80 bg-muted/15 pr-14 text-compact tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-caption font-medium text-muted-foreground">
                  mo
                </span>
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <Button type="button" className="h-10 min-w-0 flex-1 rounded-2xl" onClick={handleDone}>
                {copy.confirmDialog.done}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "size-10 shrink-0 rounded-2xl border-border/80",
                  manualOpen && "border-primary/35 bg-primary/5 text-primary",
                )}
                aria-label={copy.mutualFunds.sipInstallmentsManualEntry}
                aria-pressed={manualOpen}
                onClick={toggleManualEntry}
              >
                <Keyboard className="size-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {error ? (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          {error}
        </Badge>
      ) : null}
    </div>
  );
}
