"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShoppingCart, Wallet, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  createMfOrder,
  createMfSipPlan,
  upsertMfCartItem,
  type MfMandateType,
  type MfPaymentMethod,
} from "@/features/invest/api/invest-api";
import { MfBankAccountPicker } from "@/features/invest/components/mf-bank-account-picker";
import { MfFamilyGoalLinkPicker } from "@/features/invest/components/mf-family-goal-link-picker";
import { MfMandateTypePicker } from "@/features/invest/components/mf-mandate-type-picker";
import { MfPaymentMethodPicker } from "@/features/invest/components/mf-payment-method-picker";
import { MfSipDayPicker } from "@/features/invest/components/mf-sip-day-picker";
import { MfSipInstallmentsInput } from "@/features/invest/components/mf-sip-installments-input";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { usePaymentReadyBankAccounts } from "@/features/invest/hooks/use-payment-ready-bank-accounts";
import { MF_INVEST_PAYMENT_CARD_CLASS } from "@/features/invest/lib/mf-ui";
import {
  LUMPSUM_CALCULATOR_MAX_AMOUNT,
} from "@/features/invest/lib/mf-lumpsum-calculator";
import {
  SIP_CALCULATOR_MAX_AMOUNT,
  SIP_ORDER_DEFAULT_INSTALLMENTS,
} from "@/features/invest/lib/mf-sip-calculator";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  MfRedeemPaymentCardContent,
  type MfRedeemInputMode,
  type MfRedeemProceedPayload,
} from "@/features/invest/components/mf-invest-payment-card-redeem";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfInvestPaymentMode = "sip" | "lumpsum";
export type MfPaymentCardVariant = "invest" | "redeem";
export type { MfRedeemInputMode };

export type MfInvestPaymentCardProps = {
  variant?: MfPaymentCardVariant;
  fundName?: string | null;
  productId?: string | null;
  minLumpsumAmountInr?: number | null;
  minSipAmountInr?: number | null;
  className?: string;
  sticky?: boolean;
  showFundName?: boolean;
  preview?: boolean;
  previewBankLabel?: string;
  canInvest?: boolean;
  canRedeem?: boolean;
  sipEnabled?: boolean;
  defaultMode?: MfInvestPaymentMode;
  amount?: number;
  onAmountChange?: (amount: number) => void;
  redeemableValueInr?: number;
  redeemableUnits?: number;
  currentNav?: number;
  expectedTransferBy?: string;
  exitLoadPct?: number;
  onRedeemProceed?: (payload: MfRedeemProceedPayload) => void | Promise<void>;
  onRedeemBack?: () => void;
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

function resolveAmountFieldError(
  amount: number,
  mode: MfInvestPaymentMode,
  minSipAmountInr: number | null | undefined,
  minLumpsumAmountInr: number | null | undefined,
  options?: { requireAmount?: boolean },
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return options?.requireAmount ? copy.mutualFunds.invalidAmount : null;
  }

  if (mode === "sip") {
    if (amount > SIP_CALCULATOR_MAX_AMOUNT) {
      return copy.mutualFunds.paymentCardMaxAmountHint.replace(
        "{amount}",
        formatInr(SIP_CALCULATOR_MAX_AMOUNT, { compact: true }),
      );
    }
    if (minSipAmountInr != null && amount < minSipAmountInr) {
      return copy.mutualFunds.paymentCardMinAmountHint.replace(
        "{amount}",
        formatInr(minSipAmountInr),
      );
    }
    return null;
  }

  if (amount > LUMPSUM_CALCULATOR_MAX_AMOUNT) {
    return copy.mutualFunds.paymentCardMaxAmountHint.replace(
      "{amount}",
      formatInr(LUMPSUM_CALCULATOR_MAX_AMOUNT, { compact: true }),
    );
  }
  if (minLumpsumAmountInr != null && amount < minLumpsumAmountInr) {
    return copy.mutualFunds.paymentCardMinAmountHint.replace(
      "{amount}",
      formatInr(minLumpsumAmountInr),
    );
  }
  return null;
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
              "rounded-full px-3 py-2 text-compact font-medium transition-colors",
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
  error,
}: {
  amount: number;
  mode: MfInvestPaymentMode;
  onChange: (amount: number) => void;
  error?: string | null;
}) {
  const isEmpty = amount <= 0;
  const hasError = Boolean(error);
  const formattedAmount = formatAmountDigits(amount);
  const amountFontClass =
    formattedAmount.length > 12
      ? "text-[1.5rem]"
      : formattedAmount.length > 9
        ? "text-[1.875rem]"
        : formattedAmount.length > 7
          ? "text-[2.25rem]"
          : "text-[3rem]";

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
      <div className="flex min-h-[4rem] items-center justify-center">
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
            aria-invalid={hasError}
            placeholder="0"
            value={formattedAmount}
            onChange={(event) => handleAmountInput(event.target.value)}
            style={{ width: `${Math.max(displayLength, 1)}.5ch` }}
            className={cn(
              "min-w-[1.5ch] max-w-full border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-tight tabular-nums shadow-none outline-none focus-visible:ring-0",
              amountFontClass,
              isEmpty
                ? "text-muted-foreground/35 placeholder:text-muted-foreground/35"
                : "text-foreground",
            )}
          />
        </div>
      </div>
      {error ? (
        <div className="mt-1.5 flex justify-center">
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive"
          >
            {error}
          </Badge>
        </div>
      ) : null}
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
    <div className="flex flex-wrap justify-center gap-2.5">
      {QUICK_AMOUNTS.map((increment) => {
        const disabled = amount + increment > maxAmount;
        return (
          <button
            key={increment}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(increment)}
            className={cn(
              "rounded-full border px-5 py-2 text-compact font-medium transition-all",
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
      className="group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-2.5 text-left transition-colors hover:border-primary/25 hover:bg-muted/25"
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

function PreviewBankAccountRow({
  label,
  sectionLabel,
}: {
  label: string;
  sectionLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {sectionLabel ? (
        <p className="text-caption font-medium text-muted-foreground">{sectionLabel}</p>
      ) : null}
      <div className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-primary/25 bg-primary/[0.03] px-3.5 py-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/25">
          <Building2 className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-compact font-medium text-foreground">{label}</p>
          <p className="mt-0.5 truncate text-caption text-muted-foreground">
            {copy.mutualFunds.bankPickerUnknownBank}
          </p>
        </div>
      </div>
    </div>
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
  variant = "invest",
  fundName,
  productId,
  minLumpsumAmountInr,
  minSipAmountInr,
  className,
  sticky = true,
  showFundName = true,
  preview = true,
  previewBankLabel,
  canInvest = false,
  canRedeem = false,
  sipEnabled = true,
  defaultMode = "lumpsum",
  amount: controlledAmount,
  onAmountChange,
  redeemableValueInr,
  redeemableUnits,
  currentNav,
  expectedTransferBy,
  exitLoadPct,
  onRedeemProceed,
  onRedeemBack,
}: MfInvestPaymentCardProps) {
  const hasFundForUi = Boolean(fundName?.trim());

  if (variant === "redeem") {
    const resolvedRedeemableValue =
      redeemableValueInr ??
      (redeemableUnits != null && currentNav != null
        ? Math.round(redeemableUnits * currentNav * 100) / 100
        : 0);
    const resolvedRedeemableUnits =
      redeemableUnits ??
      (redeemableValueInr != null && currentNav != null && currentNav > 0
        ? Math.round((redeemableValueInr / currentNav) * 1000) / 1000
        : 0);

    return (
      <div
        className={cn(
          MF_INVEST_PAYMENT_CARD_CLASS,
          "flex w-full min-w-0 flex-col overflow-x-hidden min-h-[34rem]",
          sticky && "lg:sticky lg:top-6",
          !hasFundForUi && "border-dashed",
          className,
        )}
      >
        <MfRedeemPaymentCardContent
          fundName={fundName}
          previewBankLabel={previewBankLabel}
          preview={preview}
          canRedeem={canRedeem}
          redeemableValueInr={resolvedRedeemableValue}
          redeemableUnits={resolvedRedeemableUnits}
          currentNav={currentNav ?? 0}
          expectedTransferBy={expectedTransferBy}
          exitLoadPct={exitLoadPct}
          onProceed={onRedeemProceed}
          onBack={onRedeemBack}
        />
      </div>
    );
  }

  const router = useRouter();
  const { openOrderPayment, openSipMandate } = useMfPaymentOverlay();
  const [mode, setMode] = useState<MfInvestPaymentMode>(defaultMode);
  const [internalAmount, setInternalAmount] = useState(0);
  const amount = controlledAmount ?? internalAmount;
  const setAmount = onAmountChange ?? setInternalAmount;
  const [installmentDay, setInstallmentDay] = useState<number>(20);
  const [numberOfInstallments, setNumberOfInstallments] = useState<number>(
    SIP_ORDER_DEFAULT_INSTALLMENTS,
  );
  const [paymentMethod, setPaymentMethod] = useState<MfPaymentMethod>("upi");
  const [mandateType, setMandateType] = useState<MfMandateType>("upi");
  const [selectedFamilyGoalId, setSelectedFamilyGoalId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAmountValidation, setShowAmountValidation] = useState(false);
  const interactive = canInvest && !preview;
  const showSip = sipEnabled;
  const hasFund = Boolean(fundName?.trim() && productId);
  const showPaymentSection = interactive || (preview && hasFundForUi);
  const previewBankDisplay =
    previewBankLabel?.trim() || copy.mutualFunds.paymentCardPreviewBankLabel;
  const shouldLoadBankAccounts = canInvest || (hasFund && mode === "sip" && showSip);
  const {
    accounts,
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

  const amountError = useMemo(() => {
    const liveError = resolveAmountFieldError(amount, mode, minSipAmountInr, minLumpsumAmountInr);
    if (liveError) return liveError;
    if (!showAmountValidation) return null;
    return resolveAmountFieldError(amount, mode, minSipAmountInr, minLumpsumAmountInr, {
      requireAmount: true,
    });
  }, [amount, minLumpsumAmountInr, minSipAmountInr, mode, showAmountValidation]);

  function validateAmount(): string | null {
    return resolveAmountFieldError(amount, mode, minSipAmountInr, minLumpsumAmountInr, {
      requireAmount: true,
    });
  }

  function handleAmountValidationFailure() {
    setShowAmountValidation(true);
  }

  function handleModeChange(nextMode: MfInvestPaymentMode) {
    setActionError(null);
    setShowAmountValidation(false);
    setMode(nextMode);
    setAmount(clampPaymentAmountInput(amount, nextMode));
  }

  function handleAmountChange(nextAmount: number) {
    setActionError(null);
    setShowAmountValidation(false);
    setAmount(nextAmount);
  }

  function handleQuickAdd(increment: number) {
    setActionError(null);
    setShowAmountValidation(false);
    setAmount(
      clampPaymentAmountInput(amount + increment, mode),
    );
  }

  async function handleInvestNow() {
    if (!interactive || !productId) return;
    const validationError = validateAmount();
    if (validationError) {
      handleAmountValidationFailure();
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
        family_goal_id: selectedFamilyGoalId ?? undefined,
        payment_method: paymentMethod,
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
      handleAmountValidationFailure();
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
        number_of_installments: mode === "sip" ? numberOfInstallments : undefined,
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
      handleAmountValidationFailure();
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
        number_of_installments: numberOfInstallments,
        idempotency_key: crypto.randomUUID(),
        bank_account_id: selectedBankAccountId,
        family_goal_id: selectedFamilyGoalId ?? undefined,
        mandate_type: mandateType,
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
        "flex w-full min-w-0 flex-col overflow-x-hidden",
        showPaymentSection ? "min-h-[26rem]" : "min-h-[20rem]",
        sticky && "lg:sticky lg:top-6",
        !hasFundForUi && "border-dashed",
        className,
      )}
    >
      {showFundName ? (
        <div className="border-b border-zinc-200 bg-muted/10 px-4 py-2 dark:border-zinc-700/80">
          <p
            className={cn(
              "line-clamp-2 text-compact font-semibold leading-snug",
              hasFund ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between gap-4 px-4 pt-3.5 pb-4">
        {showSip ? <ModeToggle mode={mode} onChange={handleModeChange} /> : null}

        <div className={cn("space-y-2.5", mode === "lumpsum" && "mt-6")}>
          <AmountInput
            amount={amount}
            mode={mode}
            onChange={handleAmountChange}
            error={amountError}
          />
          <QuickAmountChips amount={amount} mode={mode} onAdd={handleQuickAdd} />

          {mode === "sip" && showSip ? (
            <div className="space-y-2.5">
              <MfSipDayPicker
                compact
                maxDay={SIP_MAX_INSTALLMENT_DAY}
                value={Math.min(installmentDay, SIP_MAX_INSTALLMENT_DAY)}
                onChange={setInstallmentDay}
                disabled={submitting}
              />
              <MfSipInstallmentsInput
                value={numberOfInstallments}
                onChange={setNumberOfInstallments}
                disabled={submitting}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-auto space-y-3 pt-3.5">
          {interactive && canInvest ? (
            <MfFamilyGoalLinkPicker
              selectedGoalId={selectedFamilyGoalId}
              onSelect={setSelectedFamilyGoalId}
              disabled={submitting}
            />
          ) : null}

          {showPaymentSection ? (
            mode === "sip" && showSip ? (
              <>
                <MfMandateTypePicker
                  value={mandateType}
                  onChange={setMandateType}
                  disabled={!interactive || submitting}
                />
                {interactive && canInvest ? (
                  <MfBankAccountPicker
                    accounts={accounts}
                    selectedId={selectedBankAccountId}
                    onSelect={setSelectedBankAccountId}
                    loading={banksLoading}
                    error={banksError}
                    disabled={submitting}
                  />
                ) : (
                  <PreviewBankAccountRow label={previewBankDisplay} />
                )}
              </>
            ) : (
              <>
                <MfPaymentMethodPicker
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  disabled={!interactive || submitting}
                />
                {interactive && canInvest ? (
                  <MfBankAccountPicker
                    accounts={accounts}
                    selectedId={selectedBankAccountId}
                    onSelect={setSelectedBankAccountId}
                    loading={banksLoading}
                    error={banksError}
                    disabled={submitting}
                  />
                ) : (
                  <PreviewBankAccountRow label={previewBankDisplay} />
                )}
              </>
            )
          ) : (
            <LumpsumRow />
          )}

          {actionError ? <FieldMessage variant="error" message={actionError} /> : null}

          {mode === "lumpsum" || (mode === "sip" && showSip) ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="h-9.5 gap-1.5 rounded-[var(--radius-control)] border-success/25 bg-success/5 text-success hover:bg-success/10 hover:text-success"
                disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
                onClick={() => void handleAddToCart()}
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingCart className="size-3.5" />}
                {copy.mutualFunds.paymentCardAddToCart}
              </Button>
              <Button
                className="h-9.5 rounded-[var(--radius-control)] shadow-zynd-low"
                disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
                onClick={() => void handlePrimaryAction()}
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {primaryCta}
              </Button>
            </div>
          ) : (
            <Button
              className="h-9.5 w-full rounded-[var(--radius-control)] shadow-zynd-low"
              disabled={!interactive || !canSubmit || submitting || banksLoading || !hasPaymentReadyAccount}
              onClick={() => void handlePrimaryAction()}
            >
              {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
              {primaryCta}
            </Button>
          )}

          {preview && !hasFundForUi ? (
            <p className="text-center text-caption leading-relaxed text-muted-foreground">
              {copy.mutualFunds.paymentCardEmptyDescription}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
