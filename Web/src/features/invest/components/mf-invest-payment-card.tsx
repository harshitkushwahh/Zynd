"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShoppingCart, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  createMfOrder,
  createMfSipPlan,
  upsertMfCartItem,
} from "@/features/invest/api/invest-api";
import { MfBankAccountPicker } from "@/features/invest/components/mf-bank-account-picker";
import { MfSipDayPicker } from "@/features/invest/components/mf-sip-day-picker";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { usePaymentReadyBankAccounts } from "@/features/invest/hooks/use-payment-ready-bank-accounts";
import { MF_INVEST_PAYMENT_CARD_CLASS } from "@/features/invest/lib/mf-ui";
import {
  LUMPSUM_CALCULATOR_MAX_AMOUNT,
} from "@/features/invest/lib/mf-lumpsum-calculator";
import {
  SIP_CALCULATOR_MAX_AMOUNT,
} from "@/features/invest/lib/mf-sip-calculator";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfInvestPaymentMode = "sip" | "lumpsum";

export type MfInvestPaymentCardProps = {
  fundName?: string | null;
  productId?: string | null;
  minLumpsumAmountInr?: number | null;
  minSipAmountInr?: number | null;
  className?: string;
  sticky?: boolean;
  showFundName?: boolean;
  preview?: boolean;
  canInvest?: boolean;
  sipEnabled?: boolean;
  amount?: number;
  onAmountChange?: (amount: number) => void;
};

const QUICK_AMOUNTS = [1000, 2000, 5000] as const;
const SIP_MAX_INSTALLMENT_DAY = 25;

function formatAmountDigits(value: number) {
  if (value <= 0) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function paymentMaxAmount(mode: MfInvestPaymentMode) {
  return mode === "sip" ? SIP_CALCULATOR_MAX_AMOUNT : LUMPSUM_CALCULATOR_MAX_AMOUNT;
}

function clampPaymentAmountInput(amount: number, mode: MfInvestPaymentMode) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const max = paymentMaxAmount(mode);
  return Math.min(Math.max(Math.trunc(amount), 0), max);
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MfInvestPaymentMode;
  onChange: (mode: MfInvestPaymentMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.paymentCardTitle}
      className="grid grid-cols-2 gap-1 rounded-full border border-border/80 bg-muted/20 p-1"
    >
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
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-3 py-2.5 text-compact font-medium transition-colors",
              isActive
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({
  amount,
  mode,
  onChange,
}: {
  amount: number;
  mode: MfInvestPaymentMode;
  onChange: (amount: number) => void;
}) {
  const isEmpty = amount <= 0;
  const formattedAmount = formatAmountDigits(amount);
  const amountFontClass =
    formattedAmount.length > 12
      ? "text-[1.5rem]"
      : formattedAmount.length > 9
        ? "text-[1.875rem]"
        : formattedAmount.length > 7
          ? "text-[2.25rem]"
          : "text-[2.75rem]";

  const displayLength = Math.max(formattedAmount.length, isEmpty ? 1 : 0);

  function handleAmountInput(rawValue: string) {
    const digits = rawValue.replace(/[^\d]/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) {
      onChange(0);
      return;
    }
    onChange(clampPaymentAmountInput(parsed, mode));
  }

  return (
    <div className="w-full min-w-0 px-2">
      <div className="flex min-h-[5.5rem] items-center justify-center">
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          <span
            className={cn(
              "shrink-0 font-medium leading-none text-foreground/90",
              amountFontClass,
            )}
          >
            ₹
          </span>
          <input
            id="mf-invest-payment-amount"
            type="text"
            inputMode="numeric"
            aria-label={copy.mutualFunds.paymentCardAmountSelected}
            placeholder="0"
            value={formattedAmount}
            onChange={(event) => handleAmountInput(event.target.value)}
            style={{ width: `${Math.max(displayLength, 1)}.5ch` }}
            className={cn(
              "min-w-[1.5ch] max-w-full border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-tight tabular-nums shadow-none outline-none focus-visible:ring-0",
              amountFontClass,
              isEmpty ? "text-muted-foreground/35 placeholder:text-muted-foreground/35" : "text-foreground",
            )}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAmountChips({
  amount,
  mode,
  onAdd,
}: {
  amount: number;
  mode: MfInvestPaymentMode;
  onAdd: (increment: number) => void;
}) {
  const maxAmount = paymentMaxAmount(mode);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_AMOUNTS.map((increment) => {
        const disabled = amount + increment > maxAmount;
        return (
          <button
            key={increment}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(increment)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-caption font-medium transition-all",
              disabled
                ? "cursor-not-allowed border-border/60 bg-muted/20 text-muted-foreground/45"
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

function PaymentMethodRow({
  icon: Icon,
  title,
  subtitle,
  iconClassName,
}: {
  icon: typeof Wallet;
  title: string;
  subtitle: string;
  iconClassName: string;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-3.5 text-left transition-colors hover:border-primary/25 hover:bg-muted/25"
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full ring-1",
          iconClassName,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-compact font-medium text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function LumpsumRow() {
  return (
    <PaymentMethodRow
      icon={Wallet}
      title={copy.mutualFunds.paymentCardPayViaLumpsum}
      subtitle={copy.mutualFunds.paymentCardLumpsumMethods}
      iconClassName="bg-primary/10 text-primary ring-primary/20"
    />
  );
}

export function MfInvestPaymentCard({
  fundName,
  productId,
  minLumpsumAmountInr,
  minSipAmountInr,
  className,
  sticky = true,
  showFundName = true,
  preview = true,
  canInvest = false,
  sipEnabled = true,
  amount: controlledAmount,
  onAmountChange,
}: MfInvestPaymentCardProps) {
  const router = useRouter();
  const { openOrderPayment, openSipMandate } = useMfPaymentOverlay();
  const [mode, setMode] = useState<MfInvestPaymentMode>("lumpsum");
  const [internalAmount, setInternalAmount] = useState(0);
  const amount = controlledAmount ?? internalAmount;
  const setAmount = onAmountChange ?? setInternalAmount;
  const [installmentDay, setInstallmentDay] = useState<number>(20);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const interactive = canInvest && !preview;
  const showSip = sipEnabled;
  const hasFund = Boolean(fundName?.trim() && productId);
  const shouldLoadBankAccounts = canInvest || (hasFund && mode === "sip" && showSip);
  const {
    accounts: paymentReadyAccounts,
    selectedBankAccountId,
    setSelectedBankAccountId,
    loading: banksLoading,
    error: banksError,
    hasPaymentReadyAccount,
  } = usePaymentReadyBankAccounts(shouldLoadBankAccounts);

  const title = fundName?.trim() || copy.mutualFunds.paymentCardFundPlaceholder;
  const primaryCta =
    mode === "sip" ? copy.mutualFunds.paymentCardStartSip : copy.mutualFunds.paymentCardStartLumpsum;

  useEffect(() => {
    if (!showSip && mode === "sip") {
      setMode("lumpsum");
    }
  }, [mode, showSip]);

  const canSubmit = useMemo(() => hasFund && amount > 0, [amount, hasFund]);

  function validateAmount(): string | null {
    if (!Number.isFinite(amount) || amount <= 0) {
      return copy.mutualFunds.invalidAmount;
    }
    if (mode === "sip") {
      if (amount > SIP_CALCULATOR_MAX_AMOUNT) {
        return copy.mutualFunds.maxSipError.replace(
          "{amount}",
          formatInr(SIP_CALCULATOR_MAX_AMOUNT, { compact: true }),
        );
      }
      if (minSipAmountInr != null && amount < minSipAmountInr) {
        return copy.mutualFunds.minSipError.replace("{amount}", formatInr(minSipAmountInr));
      }
      return null;
    }
    if (amount > LUMPSUM_CALCULATOR_MAX_AMOUNT) {
      return copy.mutualFunds.maxLumpsumError.replace(
        "{amount}",
        formatInr(LUMPSUM_CALCULATOR_MAX_AMOUNT, { compact: true }),
      );
    }
    if (minLumpsumAmountInr != null && amount < minLumpsumAmountInr) {
      return copy.mutualFunds.minLumpsumError.replace("{amount}", formatInr(minLumpsumAmountInr));
    }
    return null;
  }

  function handleModeChange(nextMode: MfInvestPaymentMode) {
    setActionError(null);
    setMode(nextMode);
    setAmount(clampPaymentAmountInput(amount, nextMode));
  }

  function handleAmountChange(nextAmount: number) {
    setActionError(null);
    setAmount(nextAmount);
  }

  function handleQuickAdd(increment: number) {
    setActionError(null);
    setAmount(
      clampPaymentAmountInput(amount + increment, mode),
    );
  }

  async function handleInvestNow() {
    if (!interactive || !productId) return;
    const validationError = validateAmount();
    if (validationError) {
      setActionError(validationError);
      return;
    }
    if (!hasPaymentReadyAccount || !selectedBankAccountId) {
      setActionError(copy.mutualFunds.bankPickerEmpty);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const order = await createMfOrder({
        product_id: productId,
        amount_inr: amount,
        idempotency_key: crypto.randomUUID(),
        bank_account_id: selectedBankAccountId,
      });
      openOrderPayment(order.order_id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.mutualFunds.orderFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToCart() {
    if (!interactive || !productId) return;
    const validationError = validateAmount();
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const cart = await upsertMfCartItem({
        product_id: productId,
        amount_inr: amount,
        investment_type: mode,
        installment_day: mode === "sip" ? installmentDay : undefined,
        frequency: mode === "sip" ? "monthly" : undefined,
      });
      const addedLabel =
        mode === "sip" ? copy.mutualFunds.cartSipAddedToast : copy.mutualFunds.cartAddedToast;
      toast.success(addedLabel, {
        action: {
          label: copy.mutualFunds.cartViewAction,
          onClick: () => router.push("/dashboard/mutual-funds/cart"),
        },
      });
      if (cart.item_count >= cart.max_items) {
        toast.message(copy.mutualFunds.cartFullHint);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.mutualFunds.cartAddFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartSip() {
    if (!interactive || !productId) return;
    const validationError = validateAmount();
    if (validationError) {
      setActionError(validationError);
      return;
    }
    if (!hasPaymentReadyAccount || !selectedBankAccountId) {
      setActionError(copy.mutualFunds.bankPickerEmpty);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const plan = await createMfSipPlan({
        product_id: productId,
        amount_inr: amount,
        frequency: "monthly",
        installment_day: installmentDay,
        idempotency_key: crypto.randomUUID(),
        bank_account_id: selectedBankAccountId,
      });
      openSipMandate(plan.plan_id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.mutualFunds.sipFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrimaryAction() {
    if (mode === "sip") {
      await handleStartSip();
      return;
    }
    await handleInvestNow();
  }

  return (
    <div
      className={cn(
        MF_INVEST_PAYMENT_CARD_CLASS,
        "flex min-h-[30rem] w-full min-w-0 flex-col overflow-x-hidden",
        sticky && "lg:sticky lg:top-6",
        !hasFund && "border-dashed",
        className,
      )}
    >
      {showFundName ? (
        <div className="border-b border-zinc-200 bg-muted/10 px-6 py-4 dark:border-zinc-700/80">
          <p
            className={cn(
              "line-clamp-2 text-body font-semibold leading-snug",
              hasFund ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between gap-7 px-5 py-7">
        {showSip ? <ModeToggle mode={mode} onChange={handleModeChange} /> : null}

        <div className="space-y-6">
          <AmountInput amount={amount} mode={mode} onChange={handleAmountChange} />
          <QuickAmountChips amount={amount} mode={mode} onAdd={handleQuickAdd} />

          {mode === "sip" && showSip ? (
            <MfSipDayPicker
              maxDay={SIP_MAX_INSTALLMENT_DAY}
              value={Math.min(installmentDay, SIP_MAX_INSTALLMENT_DAY)}
              onChange={setInstallmentDay}
              disabled={submitting}
            />
          ) : null}
        </div>

        <div className="mt-auto space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-700/80">
          {mode === "sip" && showSip ? (
            <MfBankAccountPicker
              label={copy.mutualFunds.paymentCardPayViaMandate}
              hint=""
              accounts={paymentReadyAccounts}
              selectedId={selectedBankAccountId}
              onSelect={setSelectedBankAccountId}
              loading={banksLoading}
              error={banksError}
              disabled={submitting}
            />
          ) : interactive && canInvest ? (
            <MfBankAccountPicker
              accounts={paymentReadyAccounts}
              selectedId={selectedBankAccountId}
              onSelect={setSelectedBankAccountId}
              loading={banksLoading}
              error={banksError}
              disabled={submitting}
            />
          ) : (
            <LumpsumRow />
          )}

          {actionError ? <FieldMessage variant="error" message={actionError} /> : null}

          {mode === "lumpsum" || (mode === "sip" && showSip) ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-[var(--radius-control)] border-success/25 bg-success/5 text-success hover:bg-success/10 hover:text-success"
                disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
                onClick={() => void handleAddToCart()}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                {copy.mutualFunds.paymentCardAddToCart}
              </Button>
              <Button
                className="h-11 rounded-[var(--radius-control)] shadow-zynd-low"
                disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
                onClick={() => void handlePrimaryAction()}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {primaryCta}
              </Button>
            </div>
          ) : (
            <Button
              className="h-11 w-full rounded-[var(--radius-control)] shadow-zynd-low"
              disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
              onClick={() => void handlePrimaryAction()}
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {primaryCta}
            </Button>
          )}

          {preview && !hasFund ? (
            <p className="text-center text-caption leading-relaxed text-muted-foreground">
              {copy.mutualFunds.paymentCardEmptyDescription}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
