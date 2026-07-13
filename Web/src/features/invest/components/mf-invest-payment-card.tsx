"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, RotateCcw, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfInvestPaymentMode = "sip" | "lumpsum";

export type MfInvestPaymentCardProps = {
  /** Fund name shown in the card header. Falls back to a placeholder when empty. */
  fundName?: string | null;
  className?: string;
  sticky?: boolean;
  /** Preview-only UI with no order placement. Defaults to true. */
  preview?: boolean;
};

const QUICK_AMOUNTS = [1000, 2000, 5000] as const;

function formatAmountDigits(value: number) {
  if (value <= 0) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MfInvestPaymentMode;
  onChange: (mode: MfInvestPaymentMode) => void;
}) {
  return (
    <div className="rounded-full border border-border/80 bg-muted/25 p-1">
      <div className="grid grid-cols-2 gap-1">
        {(
          [
            { id: "sip" as const, label: copy.mutualFunds.paymentCardMonthlySip },
            { id: "lumpsum" as const, label: copy.mutualFunds.paymentCardOneTime },
          ] as const
        ).map((option) => {
          const isActive = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-full px-3 py-2.5 text-compact font-medium transition-all",
                isActive
                  ? "border border-foreground/80 bg-card text-foreground shadow-zynd-low"
                  : "border border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AmountDisplay({ amount }: { amount: number }) {
  const amountLabel = formatAmountDigits(amount);
  const isEmpty = amount <= 0;

  return (
    <div className="space-y-1 text-center">
      <div className="flex min-h-[4.5rem] items-center justify-center gap-1.5">
        <span className="text-[2rem] font-medium leading-none text-foreground/90">₹</span>
        <span
          className={cn(
            "min-w-[2ch] text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums",
            isEmpty ? "text-muted-foreground/35" : "text-foreground",
          )}
          aria-live="polite"
        >
          {amountLabel || "0"}
        </span>
      </div>
      <p className="text-caption text-muted-foreground">
        {isEmpty ? copy.mutualFunds.paymentCardAmountHint : copy.mutualFunds.paymentCardAmountSelected}
      </p>
    </div>
  );
}

function QuickAmountChips({
  amount,
  onAdd,
}: {
  amount: number;
  onAdd: (increment: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_AMOUNTS.map((increment) => {
        const isSelected = amount >= increment && amount % increment === 0 && amount > 0;
        return (
          <button
            key={increment}
            type="button"
            onClick={() => onAdd(increment)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-caption font-medium transition-all",
              isSelected
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border/80 bg-card text-foreground hover:border-primary/35 hover:bg-muted/40",
            )}
          >
            {copy.mutualFunds.paymentCardQuickAdd.replace(
              "{amount}",
              new Intl.NumberFormat("en-IN").format(increment),
            )}
          </button>
        );
      })}
    </div>
  );
}

function MandateRow() {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3 py-3 text-left transition-colors hover:border-primary/25 hover:bg-muted/25"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/20">
        <RotateCcw className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-compact font-medium text-foreground">{copy.mutualFunds.paymentCardPayViaMandate}</p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">
          {copy.mutualFunds.paymentCardMandateBank}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

export function MfInvestPaymentCard({
  fundName,
  className,
  sticky = true,
  preview = true,
}: MfInvestPaymentCardProps) {
  const [mode, setMode] = useState<MfInvestPaymentMode>("sip");
  const [amount, setAmount] = useState(0);

  const hasFund = Boolean(fundName?.trim());
  const title = fundName?.trim() || copy.mutualFunds.paymentCardFundPlaceholder;
  const primaryCta =
    mode === "sip" ? copy.mutualFunds.paymentCardStartSip : copy.mutualFunds.paymentCardStartLumpsum;

  const canSubmit = useMemo(() => hasFund && amount > 0, [amount, hasFund]);

  return (
    <div
      className={cn(
        MF_CARD_RADIUS_CLASS,
        "flex h-fit w-full flex-col overflow-hidden border border-border/80 bg-card shadow-zynd-mid",
        sticky && "lg:sticky lg:top-6",
        !hasFund && "border-dashed",
        className,
      )}
    >
      <div className="border-b border-border/80 bg-muted/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "line-clamp-2 text-body font-semibold leading-snug",
              hasFund ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
          {preview ? (
            <span className="shrink-0 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-5 py-5">
        <ModeToggle mode={mode} onChange={setMode} />

        <div className="space-y-5">
          <AmountDisplay amount={amount} />
          <QuickAmountChips amount={amount} onAdd={(increment) => setAmount((current) => current + increment)} />

          {mode === "sip" ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-border/80 bg-muted/15 px-4 py-3 text-compact font-medium text-foreground transition-colors hover:border-primary/25 hover:bg-muted/25"
            >
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" />
                {copy.mutualFunds.paymentCardSipDate}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-border/80 pt-5">
          <MandateRow />

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-[var(--radius-control)] border-success/25 bg-success/5 text-success hover:bg-success/10 hover:text-success"
              disabled={preview || !canSubmit}
            >
              <ShoppingCart className="size-4" />
              {copy.mutualFunds.paymentCardAddToCart}
            </Button>
            <Button
              className="h-11 rounded-[var(--radius-control)] shadow-zynd-low"
              disabled={preview || !canSubmit}
            >
              {primaryCta}
            </Button>
          </div>

          {preview ? (
            <p className="text-center text-caption leading-relaxed text-muted-foreground">
              {copy.mutualFunds.paymentCardDummyNote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
