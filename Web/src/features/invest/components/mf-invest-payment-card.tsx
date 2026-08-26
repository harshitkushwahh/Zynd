"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShoppingCart, Wallet } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";
import {
  formatBankAccountPickerLabel,
  resolveBankAccountDisplayName,
} from "@/shared/lib/bank-account-display";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  createMfOrder,
  createMfSipPlan,
  validateMfSipPlan,
  upsertMfCartItem,
  type MfMandateType,
  type MfPaymentMethod,
} from "@/features/invest/api/invest-api";
import { MfBankAccountPicker } from "@/features/invest/components/mf-bank-account-picker";
import { MfInvestSelectedFundCard } from "@/features/invest/components/mf-invest-selected-fund-card";
import { MfFamilyGoalLinkPicker } from "@/features/invest/components/mf-family-goal-link-picker";
import { MfMandateTypePicker } from "@/features/invest/components/mf-mandate-type-picker";
import { MfPaymentMethodPicker } from "@/features/invest/components/mf-payment-method-picker";
import { MfSipDayPicker } from "@/features/invest/components/mf-sip-day-picker";
import { MfAmountRollDisplay } from "@/features/invest/components/mf-amount-roll-display";
import { MfSipInstallmentsInput } from "@/features/invest/components/mf-sip-installments-input";
import { useMfPaymentOverlay } from "@/features/invest/contexts/mf-payment-overlay-context";
import { useMfCartQuery } from "@/features/invest/hooks/use-mf-cart-query";
import { usePaymentReadyBankAccounts } from "@/features/invest/hooks/use-payment-ready-bank-accounts";
import { useAddBankAccountAction } from "@/features/invest/hooks/use-add-bank-account-action";
import { ApiError } from "@/lib/api-client";
import { canAddToMfCart, getMfCartMaxItems } from "@/features/invest/lib/mf-cart-limits";
import { cartTypeFullMessage } from "@/features/invest/lib/mf-screener-queue-messages";
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
  amcLogoUrl?: string | null;
  amcName?: string | null;
  amcSlug?: string | null;
  productId?: string | null;
  minLumpsumAmountInr?: number | null;
  minSipAmountInr?: number | null;
  className?: string;
  sticky?: boolean;
  showFundName?: boolean;
  preview?: boolean;
  previewBankLabel?: string;
  previewBankName?: string | null;
  previewBankIfsc?: string | null;
  canInvest?: boolean;
  canRedeem?: boolean;
  sipEnabled?: boolean;
  /** Extra space between mode toggle and amount input (portfolio sidebar). */
  relaxedAmountSpacing?: boolean;
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
const SIP_MAX_INSTALLMENT_DAY = 28;

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

function resolveAmountFontSize(digitLength: number) {
  if (digitLength > 12) return "1.875rem";
  if (digitLength > 9) return "2.375rem";
  if (digitLength > 7) return "3rem";
  return "4rem";
}

type ChipRollRequest = {
  id: number;
  targetAmount: number;
};

type RollStep = {
  from: string;
  to: string;
  toAmount: number;
};

type RollLayoutLock = {
  fontSize: string;
  widthPx: number;
  measureText: string;
};

function pickLongestFormattedAmount(...amounts: number[]) {
  return amounts.reduce((longest, value) => {
    const formatted = formatAmountDigits(value) || "0";
    return formatted.length > longest.length ? formatted : longest;
  }, "0");
}

function AmountInput({
  amount,
  mode,
  onChange,
  error,
  chipRollRequest,
}: {
  amount: number;
  mode: MfInvestPaymentMode;
  onChange: (amount: number) => void;
  error?: string | null;
  chipRollRequest?: ChipRollRequest | null;
}) {
  const isEmpty = amount <= 0;
  const hasError = Boolean(error);
  const formattedAmount = formatAmountDigits(amount);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number | null>(null);
  const [rollLayout, setRollLayout] = useState<RollLayoutLock | null>(null);
  const rollQueueRef = useRef<number[]>([]);
  const isDrainingRollRef = useRef(false);
  const lastChipRollIdRef = useRef(0);
  const visualAmountRef = useRef(amount);
  const [rollStep, setRollStep] = useState<RollStep | null>(null);
  const isRolling = rollStep !== null;
  const isRollSessionActive = rollLayout !== null;

  const activeFontSize =
    rollLayout?.fontSize ?? resolveAmountFontSize(formattedAmount.length);
  const displayLength = Math.max(
    (rollLayout?.measureText ?? formattedAmount).length,
    amount <= 0 ? 1 : 0,
  );
  const measuredText = rollLayout?.measureText ?? rollStep?.to ?? (formattedAmount || "0");
  const activeWidthPx = rollLayout?.widthPx ?? inputWidth;

  const releaseRollLayout = useCallback(() => {
    setRollLayout(null);
  }, []);

  const beginRollStep = useCallback((fromAmount: number, toAmount: number) => {
    setRollStep({
      from: formatAmountDigits(fromAmount) || "0",
      to: formatAmountDigits(toAmount) || "0",
      toAmount,
    });
  }, []);

  const startNextRollStep = useCallback(() => {
    const nextTarget = rollQueueRef.current.shift();
    if (nextTarget === undefined) {
      isDrainingRollRef.current = false;
      setRollStep(null);
      releaseRollLayout();
      return;
    }
    beginRollStep(visualAmountRef.current, nextTarget);
  }, [beginRollStep, releaseRollLayout]);

  const enqueueChipRoll = useCallback(
    (targetAmount: number) => {
      rollQueueRef.current.push(targetAmount);
      const queuedAmounts = [visualAmountRef.current, ...rollQueueRef.current];
      const measureText = pickLongestFormattedAmount(...queuedAmounts);

      if (!isDrainingRollRef.current) {
        isDrainingRollRef.current = true;
        setRollLayout({
          fontSize: resolveAmountFontSize(measureText.length),
          widthPx: 0,
          measureText,
        });
        startNextRollStep();
        return;
      }

      setRollLayout((current) => {
        if (!current || measureText.length <= current.measureText.length) {
          return current;
        }
        return {
          ...current,
          measureText,
          widthPx: 0,
        };
      });
    },
    [startNextRollStep],
  );

  const handleRollStepComplete = useCallback(() => {
    setRollStep((current) => {
      if (current) {
        visualAmountRef.current = current.toAmount;
      }

      const nextTarget = rollQueueRef.current.shift();
      if (nextTarget === undefined) {
        isDrainingRollRef.current = false;
        releaseRollLayout();
        return null;
      }

      const fromAmount = visualAmountRef.current;
      return {
        from: formatAmountDigits(fromAmount) || "0",
        to: formatAmountDigits(nextTarget) || "0",
        toAmount: nextTarget,
      };
    });
  }, []);

  const cancelRollQueue = useCallback(() => {
    rollQueueRef.current = [];
    isDrainingRollRef.current = false;
    visualAmountRef.current = amount;
    setRollStep(null);
    releaseRollLayout();
  }, [amount, releaseRollLayout]);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const nextWidth = measureRef.current.offsetWidth;
    setInputWidth(nextWidth);
    setRollLayout((current) => {
      if (!current || current.widthPx !== 0) return current;
      return { ...current, widthPx: nextWidth };
    });
  }, [activeFontSize, measuredText, isRollSessionActive]);

  useEffect(() => {
    if (isRolling || isDrainingRollRef.current) return;
    visualAmountRef.current = amount;
  }, [amount, isRolling]);

  useEffect(() => {
    if (!chipRollRequest || chipRollRequest.id === lastChipRollIdRef.current) return;
    lastChipRollIdRef.current = chipRollRequest.id;
    enqueueChipRoll(chipRollRequest.targetAmount);
  }, [chipRollRequest, enqueueChipRoll]);

  function handleAmountInput(rawValue: string) {
    cancelRollQueue();
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
    <div className="w-full min-w-0">
      <div className="flex min-h-[5.5rem] w-full items-center justify-center py-1">
        <div className="relative inline-flex max-w-full items-center justify-center gap-1">
          <span
            ref={measureRef}
            aria-hidden
            style={{ fontSize: activeFontSize, lineHeight: 1 }}
            className="pointer-events-none absolute -z-10 whitespace-pre opacity-0 font-semibold tabular-nums tracking-tight"
          >
            {measuredText}
          </span>
          <span
            style={{ fontSize: activeFontSize, lineHeight: 1 }}
            className="shrink-0 font-medium leading-none text-foreground/80"
          >
            ₹
          </span>
          <div
            className="grid max-w-[calc(100%-1.75rem)]"
            style={{
              fontSize: activeFontSize,
              lineHeight: 1,
              height: activeFontSize,
              width: activeWidthPx ? `${activeWidthPx}px` : `${displayLength}ch`,
            }}
          >
            <input
              id="mf-invest-payment-amount"
              type="text"
              inputMode="numeric"
              aria-label={copy.mutualFunds.paymentCardAmountSelected}
              aria-invalid={hasError}
              placeholder={isRolling ? "" : "0"}
              value={formattedAmount}
              onChange={(event) => handleAmountInput(event.target.value)}
              onFocus={cancelRollQueue}
              style={{ fontSize: activeFontSize, lineHeight: 1, height: activeFontSize }}
              className={cn(
                "col-start-1 row-start-1 w-full border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-tight tabular-nums shadow-none outline-none focus-visible:ring-0",
                isRolling && "text-transparent caret-transparent selection:bg-transparent",
                isEmpty && !isRolling
                  ? "text-muted-foreground/35 placeholder:text-muted-foreground/35"
                  : !isRolling && "text-foreground/85",
              )}
            />
            {rollStep ? (
              <div className="col-start-1 row-start-1 pointer-events-none isolate overflow-hidden">
                <MfAmountRollDisplay
                  key={`${rollStep.from}-${rollStep.to}`}
                  fromValue={rollStep.from}
                  toValue={rollStep.to}
                  fontSize={activeFontSize}
                  onComplete={handleRollStepComplete}
                />
              </div>
            ) : null}
          </div>
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
                : "border-border/80 bg-card text-foreground/75 hover:border-primary/35 hover:bg-muted/40",
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
  bankName,
  ifscCode,
}: {
  label: string;
  sectionLabel?: string;
  bankName?: string | null;
  ifscCode?: string | null;
}) {
  const resolvedBankName = resolveBankAccountDisplayName({
    bankName,
    ifscCode,
    accountLabel: label,
  });
  const displayLabel = formatBankAccountPickerLabel({
    bankName: resolvedBankName,
    ifscCode,
    accountLabel: label,
    unknownBankLabel: copy.mutualFunds.bankPickerUnknownBank,
  });

  return (
    <div className="space-y-2">
      {sectionLabel ? (
        <p className="text-caption font-medium text-muted-foreground">{sectionLabel}</p>
      ) : null}
      <div className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-primary/25 bg-primary/[0.03] px-3.5 py-2.5">
        <BankLogo
          bankName={resolvedBankName}
          ifscCode={ifscCode}
          accountLabel={label}
          size="md"
          fallbackClassName="bg-success/15 text-success ring-success/25"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-compact font-medium text-foreground">{displayLabel}</p>
          {ifscCode ? (
            <p className="mt-0.5 truncate text-caption text-muted-foreground">
              {copy.mutualFunds.bankPickerPayoutIfsc} {ifscCode}
            </p>
          ) : null}
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
  amcLogoUrl,
  amcName,
  amcSlug,
  productId,
  minLumpsumAmountInr,
  minSipAmountInr,
  className,
  sticky = true,
  showFundName = true,
  preview = true,
  previewBankLabel,
  previewBankName,
  previewBankIfsc,
  canInvest = false,
  canRedeem = false,
  sipEnabled = true,
  relaxedAmountSpacing = false,
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
          previewBankName={previewBankName}
          previewBankIfsc={previewBankIfsc}
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
  const chipRollIdRef = useRef(0);
  const [chipRollRequest, setChipRollRequest] = useState<ChipRollRequest | null>(null);
  const interactive = canInvest && !preview;
  const showSip = sipEnabled;
  const hasFund = Boolean(fundName?.trim() && productId);
  const showPaymentSection = interactive || (preview && hasFundForUi);
  const previewBankDisplay =
    previewBankLabel?.trim() || copy.mutualFunds.paymentCardPreviewBankLabel;
  const shouldLoadBankAccounts =
    canInvest || (showPaymentSection && hasFundForUi && (mode === "sip" ? showSip : true));
  const {
    accounts,
    allAccounts,
    selectedBankAccountId,
    setSelectedBankAccountId,
    loading: banksLoading,
    error: banksError,
    hasPaymentReadyAccount,
    reloadAccounts,
  } = usePaymentReadyBankAccounts(shouldLoadBankAccounts);
  const { canAddAccount, requestAddBankAccount } = useAddBankAccountAction({
    accounts: allAccounts,
    onAccountAdded: () => {
      void reloadAccounts();
    },
  });
  const bankPickerProps = {
    onAddAccount: requestAddBankAccount,
    canAddAccount,
  };
  const { data: cart } = useMfCartQuery(interactive && hasFund);
  const selectedBankAccount = useMemo(
    () => accounts.find((account) => account.id === selectedBankAccountId) ?? accounts[0] ?? null,
    [accounts, selectedBankAccountId],
  );

  const previewBankRow = useMemo(() => {
    if (selectedBankAccount) {
      return {
        label: previewBankDisplay,
        bankName: selectedBankAccount.bank_name,
        ifscCode: selectedBankAccount.ifsc_code,
      };
    }
    return {
      label: previewBankDisplay,
      bankName: previewBankName,
      ifscCode: previewBankIfsc,
    };
  }, [
    previewBankDisplay,
    previewBankIfsc,
    previewBankName,
    selectedBankAccount,
  ]);

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
    const nextAmount = clampPaymentAmountInput(amount + increment, mode);
    setAmount(nextAmount);
    chipRollIdRef.current += 1;
    setChipRollRequest({ id: chipRollIdRef.current, targetAmount: nextAmount });
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

    if (cart && !canAddToMfCart(cart, productId, mode)) {
      const message = cartTypeFullMessage(mode, getMfCartMaxItems(cart));
      setActionError(message);
      toast.error(message);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const nextCart = await upsertMfCartItem({
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
      if (nextCart.lumpsum_item_count >= nextCart.max_items && mode === "lumpsum") {
        toast.message(cartTypeFullMessage("lumpsum", getMfCartMaxItems(nextCart)));
      } else if (nextCart.sip_item_count >= nextCart.max_items && mode === "sip") {
        toast.message(cartTypeFullMessage("sip", getMfCartMaxItems(nextCart)));
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
      await validateMfSipPlan({
        product_id: productId,
        amount_inr: amount,
        frequency: "monthly",
        installment_day: installmentDay,
        number_of_installments: numberOfInstallments,
      });

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
      if (
        plan.mandate?.status?.toUpperCase() === "APPROVED" &&
        plan.next_action !== "authorize_mandate"
      ) {
        toast.message(copy.mutualFunds.sipMandateReuseNote);
      }
      openSipMandate(plan.plan_id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "sip_not_allowed") {
        setMode("lumpsum");
      }
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

  const showFamilyGoalLink = interactive && canInvest;
  const spaciousAmountLayout = relaxedAmountSpacing || (!showFundName && hasFundForUi);

  const paymentCard = (
    <div
      className={cn(
        MF_INVEST_PAYMENT_CARD_CLASS,
        "flex w-full min-w-0 flex-col overflow-x-hidden",
        showPaymentSection ? "min-h-[26rem]" : "min-h-[20rem]",
        !showFundName && sticky && "lg:sticky lg:top-6",
        !showFundName && !hasFundForUi && "border-dashed",
        !showFundName && className,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-4 pb-4",
          spaciousAmountLayout ? "pt-5" : "pt-3.5",
        )}
      >
        <div
          className={cn(
            "flex flex-col",
            spaciousAmountLayout ? "gap-12" : "gap-6",
            showSip ? null : "pt-1",
          )}
        >
          {showSip ? <ModeToggle mode={mode} onChange={handleModeChange} /> : null}

          <div className="space-y-3.5">
            <AmountInput
              amount={amount}
              mode={mode}
              onChange={handleAmountChange}
              error={amountError}
              chipRollRequest={chipRollRequest}
            />
            <QuickAmountChips amount={amount} mode={mode} onAdd={handleQuickAdd} />
          </div>
        </div>

        <div className="mt-auto flex flex-col space-y-3.5 pt-3.5">
          {mode === "sip" && showSip ? (
            <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2">
              <MfSipDayPicker
                compact
                maxDay={SIP_MAX_INSTALLMENT_DAY}
                value={Math.min(installmentDay, SIP_MAX_INSTALLMENT_DAY)}
                onChange={setInstallmentDay}
                disabled={submitting}
              />
              <MfSipInstallmentsInput
                compact
                value={numberOfInstallments}
                onChange={setNumberOfInstallments}
                disabled={submitting}
              />
            </div>
          ) : null}

          {showFamilyGoalLink ? (
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
                    {...bankPickerProps}
                  />
                ) : (
                  <PreviewBankAccountRow
                    label={previewBankRow.label}
                    bankName={previewBankRow.bankName}
                    ifscCode={previewBankRow.ifscCode}
                  />
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
                    {...bankPickerProps}
                  />
                ) : (
                  <PreviewBankAccountRow
                    label={previewBankRow.label}
                    bankName={previewBankRow.bankName}
                    ifscCode={previewBankRow.ifscCode}
                  />
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

  if (showFundName) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-3",
          sticky && "lg:sticky lg:top-6",
          className,
        )}
      >
        <MfInvestSelectedFundCard
          fundName={fundName}
          amcLogoUrl={amcLogoUrl}
          amcName={amcName}
          amcSlug={amcSlug}
          selected={hasFundForUi}
        />
        {paymentCard}
      </div>
    );
  }

  return paymentCard;
}
