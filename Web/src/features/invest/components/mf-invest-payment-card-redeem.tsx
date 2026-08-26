"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Info, Loader2, Settings } from "lucide-react";

import { BankLogo } from "@/components/banking/bank-logo";
import {
  formatBankAccountPickerLabel,
  resolveBankAccountDisplayName,
} from "@/shared/lib/bank-account-display";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldMessage } from "@/components/ui/ui-message";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfRedeemInputMode = "amount" | "units";

export type MfRedeemProceedPayload = {
  mode: MfRedeemInputMode;
  amount: number;
  units: number;
  redeemAll: boolean;
};

export type MfRedeemPaymentCardProps = {
  fundName?: string | null;
  previewBankLabel?: string;
  previewBankName?: string | null;
  previewBankIfsc?: string | null;
  preview?: boolean;
  canRedeem?: boolean;
  redeemableValueInr: number;
  redeemableUnits: number;
  currentNav: number;
  expectedTransferBy?: string;
  exitLoadPct?: number;
  exitLoadPeriodLabel?: string;
  sticky?: boolean;
  className?: string;
  onProceed?: (payload: MfRedeemProceedPayload) => void | Promise<void>;
  onBack?: () => void;
};

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function roundUnits(value: number) {
  return Math.round(value * 1000) / 1000;
}

function unitsToAmount(units: number, nav: number) {
  return roundAmount(units * nav);
}

function amountToUnits(amount: number, nav: number) {
  if (nav <= 0) return 0;
  return roundUnits(amount / nav);
}

function formatRedeemAmountDigits(value: number) {
  if (value <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRedeemUnitDigits(value: number) {
  if (value <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function parseDecimalInput(rawValue: string, maxDecimals: number) {
  const cleaned = rawValue.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;

  const [whole = "", ...fractionParts] = cleaned.split(".");
  const fraction = fractionParts.join("").slice(0, maxDecimals);
  const normalized = fraction ? `${whole}.${fraction}` : whole;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampRedeemAmount(amount: number, maxAmount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(roundAmount(amount), maxAmount);
}

function clampRedeemUnits(units: number, maxUnits: number) {
  if (!Number.isFinite(units) || units <= 0) return 0;
  return Math.min(roundUnits(units), maxUnits);
}

function formatExpectedTransferDate(daysAhead = 4) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatRedeemInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function RedeemValueInput({
  mode,
  amount,
  units,
  maxAmount,
  maxUnits,
  onAmountChange,
  onUnitsChange,
  error,
}: {
  mode: MfRedeemInputMode;
  amount: number;
  units: number;
  maxAmount: number;
  maxUnits: number;
  onAmountChange: (amount: number) => void;
  onUnitsChange: (units: number) => void;
  error?: string | null;
}) {
  const isAmountMode = mode === "amount";
  const value = isAmountMode ? amount : units;
  const isEmpty = value <= 0;
  const formattedValue = isAmountMode
    ? formatRedeemAmountDigits(amount)
    : formatRedeemUnitDigits(units);
  const amountFontClass =
    formattedValue.length > 12
      ? "text-[1.5rem]"
      : formattedValue.length > 9
        ? "text-[1.875rem]"
        : formattedValue.length > 7
          ? "text-[2.25rem]"
          : "text-[3rem]";
  const displayLength = Math.max(formattedValue.length, isEmpty ? 1 : 0);

  function handleInput(rawValue: string) {
    if (isAmountMode) {
      onAmountChange(clampRedeemAmount(parseDecimalInput(rawValue, 2), maxAmount));
      return;
    }
    onUnitsChange(clampRedeemUnits(parseDecimalInput(rawValue, 3), maxUnits));
  }

  return (
    <div className="w-full min-w-0 px-2">
      <div className="flex min-h-[6rem] items-center justify-center">
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {isAmountMode ? (
            <span
              className={cn(
                "shrink-0 font-medium leading-none text-foreground/90",
                amountFontClass,
              )}
            >
              ₹
            </span>
          ) : null}
          <input
            id="mf-redeem-payment-value"
            type="text"
            inputMode="decimal"
            aria-label={
              isAmountMode
                ? copy.mutualFunds.paymentCardRedeemAmountSelected
                : copy.mutualFunds.paymentCardRedeemUnitsSelected
            }
            aria-invalid={Boolean(error)}
            placeholder="0"
            value={formattedValue}
            onChange={(event) => handleInput(event.target.value)}
            style={{ width: `${Math.max(displayLength, 1)}.5ch` }}
            className={cn(
              "min-w-[1.5ch] max-w-full border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-tight tabular-nums shadow-none outline-none focus-visible:ring-0",
              amountFontClass,
              isEmpty
                ? "text-muted-foreground/35 placeholder:text-muted-foreground/35"
                : "text-foreground",
            )}
          />
          {!isAmountMode ? (
            <span className="ml-1 shrink-0 text-compact font-medium text-muted-foreground">
              units
            </span>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="mt-1.5 flex justify-center">
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
            {error}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

function RedeemExitLoadDetail({
  fundName,
  redeemAmount,
  exitLoadAmount,
  netAmount,
  exitLoadPct,
  exitLoadPeriodLabel,
  onBack,
}: {
  fundName: string;
  redeemAmount: number;
  exitLoadAmount: number;
  netAmount: number;
  exitLoadPct: number;
  exitLoadPeriodLabel: string;
  onBack: () => void;
}) {
  const rows = [
    {
      label: copy.mutualFunds.paymentCardRedeemExitLoadRedeemAmount,
      value: formatRedeemInr(redeemAmount),
      emphasize: false,
    },
    {
      label: copy.mutualFunds.paymentCardRedeemExitLoadDeduction,
      value: `- ${formatRedeemInr(exitLoadAmount)}`,
      emphasize: false,
    },
    {
      label: copy.mutualFunds.paymentCardRedeemExitLoadNetAmount,
      value: formatRedeemInr(netAmount),
      emphasize: true,
    },
  ] as const;

  return (
    <>
      <div className="border-b border-zinc-200 bg-muted/10 px-4 py-4 dark:border-zinc-700/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={copy.mutualFunds.paymentCardRedeemBack}
          >
            <ArrowLeft className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-compact font-semibold text-foreground">
            {copy.mutualFunds.paymentCardRedeemTitle} {fundName}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 px-4 py-5">
        <div className="space-y-4">
          <div>
            <h3 className="text-body font-semibold text-foreground">
              {copy.mutualFunds.paymentCardRedeemExitLoadDetailTitle}
            </h3>
            <p className="mt-1.5 text-compact text-muted-foreground">
              {copy.mutualFunds.paymentCardRedeemExitLoadRule
                .replace("{pct}", String(exitLoadPct))
                .replace("{period}", exitLoadPeriodLabel)}
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border/80 bg-card px-4 py-4">
            <dl className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <dt className="text-compact text-muted-foreground">{row.label}</dt>
                  <dd
                    className={cn(
                      "shrink-0 text-compact tabular-nums text-foreground",
                      row.emphasize && "font-semibold",
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 border-t border-border/60 pt-3 text-caption leading-relaxed text-muted-foreground">
              {copy.mutualFunds.paymentCardRedeemExitLoadNavNote}
            </p>
          </div>
        </div>

        <Button
          type="button"
          className="h-10 w-full rounded-[var(--radius-control)] shadow-zynd-low"
          onClick={onBack}
        >
          {copy.mutualFunds.paymentCardRedeemExitLoadOkay}
        </Button>
      </div>
    </>
  );
}

function RedeemBankRow({
  label,
  expectedTransferBy,
  bankName,
  ifscCode,
}: {
  label: string;
  expectedTransferBy: string;
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
    <div className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-2.5">
      <BankLogo
        bankName={resolvedBankName}
        ifscCode={ifscCode}
        accountLabel={label}
        size="md"
        fallbackClassName="bg-success/15 text-success ring-success/25"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-compact font-medium text-foreground">{displayLabel}</p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">
          {copy.mutualFunds.paymentCardRedeemExpectedTransfer.replace("{date}", expectedTransferBy)}
        </p>
      </div>
    </div>
  );
}

export function MfRedeemPaymentCardContent({
  fundName,
  previewBankLabel,
  previewBankName,
  previewBankIfsc,
  preview = true,
  canRedeem = false,
  redeemableValueInr,
  redeemableUnits,
  currentNav,
  expectedTransferBy,
  exitLoadPct = 1,
  exitLoadPeriodLabel = "1 year",
  onProceed,
  onBack,
}: MfRedeemPaymentCardProps) {
  const [inputMode, setInputMode] = useState<MfRedeemInputMode>("amount");
  const [amount, setAmount] = useState(0);
  const [units, setUnits] = useState(0);
  const [redeemAll, setRedeemAll] = useState(false);
  const [exitLoadOpen, setExitLoadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const interactive = canRedeem && !preview;
  const maxAmount = roundAmount(redeemableValueInr);
  const maxUnits = roundUnits(redeemableUnits);
  const title = fundName?.trim() || copy.mutualFunds.paymentCardFundPlaceholder;
  const bankLabel = previewBankLabel?.trim() || copy.mutualFunds.paymentCardPreviewBankLabel;
  const transferBy = expectedTransferBy ?? formatExpectedTransferDate();
  const displayRedeemAmount = amount > 0 ? amount : maxAmount;
  const exitLoadApprox = roundAmount(displayRedeemAmount * (exitLoadPct / 100));
  const netRedeemAmount = roundAmount(Math.max(displayRedeemAmount - exitLoadApprox, 0));

  useEffect(() => {
    if (!redeemAll) return;
    if (inputMode === "amount") {
      setAmount(maxAmount);
      setUnits(maxUnits);
      return;
    }
    setUnits(maxUnits);
    setAmount(maxAmount);
  }, [inputMode, maxAmount, maxUnits, redeemAll]);

  const amountError = useMemo(() => {
    if (amount <= 0) return null;
    if (amount > maxAmount) {
      return copy.mutualFunds.paymentCardMaxAmountHint.replace("{amount}", formatInr(maxAmount));
    }
    return null;
  }, [amount, maxAmount]);

  const unitsError = useMemo(() => {
    if (units <= 0) return null;
    if (units > maxUnits) {
      return `Maximum is ${formatRedeemUnitDigits(maxUnits)} units`;
    }
    return null;
  }, [maxUnits, units]);

  const fieldError = inputMode === "amount" ? amountError : unitsError;
  const canSubmit = inputMode === "amount" ? amount > 0 && !amountError : units > 0 && !unitsError;

  function handleAmountChange(nextAmount: number) {
    setActionError(null);
    setRedeemAll(nextAmount >= maxAmount);
    setAmount(nextAmount);
    setUnits(amountToUnits(nextAmount, currentNav));
  }

  function handleUnitsChange(nextUnits: number) {
    setActionError(null);
    setRedeemAll(nextUnits >= maxUnits);
    setUnits(nextUnits);
    setAmount(unitsToAmount(nextUnits, currentNav));
  }

  function handleInputModeChange(nextMode: MfRedeemInputMode) {
    setInputMode(nextMode);
    setActionError(null);
  }

  function handleRedeemAllChange(checked: boolean) {
    setRedeemAll(checked);
    if (!checked) {
      setAmount(0);
      setUnits(0);
      return;
    }
    setAmount(maxAmount);
    setUnits(maxUnits);
  }

  async function handleProceed() {
    if (!interactive || !canSubmit) return;
    setSubmitting(true);
    setActionError(null);
    try {
      if (onProceed) {
        await onProceed({
          mode: inputMode,
          amount,
          units,
          redeemAll,
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : copy.mutualFunds.orderFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {exitLoadOpen ? (
        <div className="flex min-h-full flex-1 flex-col">
        <RedeemExitLoadDetail
          fundName={title}
          redeemAmount={displayRedeemAmount}
          exitLoadAmount={exitLoadApprox}
          netAmount={netRedeemAmount}
          exitLoadPct={exitLoadPct}
          exitLoadPeriodLabel={exitLoadPeriodLabel}
          onBack={() => setExitLoadOpen(false)}
        />
        </div>
      ) : (
        <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-zinc-200 bg-muted/10 px-4 py-4 dark:border-zinc-700/80">
        <div className="flex items-start gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label={copy.mutualFunds.paymentCardRedeemBackToInvest}
            >
              <ArrowLeft className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-compact font-semibold leading-snug text-foreground">
              {copy.mutualFunds.paymentCardRedeemTitle} {title}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label={copy.mutualFunds.paymentCardRedeemSettingsLabel}
            >
              <Settings className="size-4" strokeWidth={2.25} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuRadioGroup
                value={inputMode}
                onValueChange={(value) => handleInputModeChange(value as MfRedeemInputMode)}
              >
                <DropdownMenuLabel>{copy.mutualFunds.paymentCardRedeemInputModeLabel}</DropdownMenuLabel>
                <DropdownMenuRadioItem value="amount">
                  {copy.mutualFunds.paymentCardRedeemInputModeAmount}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="units">
                  {copy.mutualFunds.paymentCardRedeemInputModeUnits}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-8 px-4 pt-6 pb-7">
        <div className="space-y-5">
          <div className="space-y-2">
            <RedeemValueInput
              mode={inputMode}
              amount={amount}
              units={units}
              maxAmount={maxAmount}
              maxUnits={maxUnits}
              onAmountChange={handleAmountChange}
              onUnitsChange={handleUnitsChange}
              error={fieldError}
            />

            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge
                      variant="secondary"
                      className="cursor-help gap-1 px-2.5 py-1 text-caption font-medium tabular-nums"
                    />
                  }
                >
                  {inputMode === "amount"
                    ? copy.mutualFunds.paymentCardRedeemAvailable.replace(
                        "{amount}",
                        formatInr(maxAmount),
                      )
                    : copy.mutualFunds.paymentCardRedeemUnitsAvailable.replace(
                        "{units}",
                        formatRedeemUnitDigits(maxUnits),
                      )}
                  <Info className="size-3 opacity-70" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[15rem] text-pretty">
                  {copy.mutualFunds.paymentCardRedeemAvailableTooltip}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2.5">
            <input
              type="checkbox"
              checked={redeemAll}
              onChange={(event) => handleRedeemAllChange(event.target.checked)}
              className="size-4 rounded-[4px] border-border accent-success"
            />
            <span className="text-compact font-medium text-foreground">
              {copy.mutualFunds.paymentCardRedeemAll}
            </span>
          </label>
        </div>

        <div className="mt-auto space-y-4 pt-5">
          <button
            type="button"
            onClick={() => setExitLoadOpen(true)}
            className="group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/20 px-3.5 py-2.5 text-left transition-colors hover:border-primary/25 hover:bg-muted/30"
          >
            <p className="min-w-0 flex-1 text-compact leading-snug text-muted-foreground">
              {copy.mutualFunds.paymentCardRedeemExitLoad.replace(
                "{amount}",
                formatRedeemInr(exitLoadApprox),
              )}
            </p>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </button>

          <RedeemBankRow
            label={bankLabel}
            expectedTransferBy={transferBy}
            bankName={previewBankName}
            ifscCode={previewBankIfsc}
          />

          {actionError ? <FieldMessage variant="error" message={actionError} /> : null}

          <Button
            className="h-10 w-full rounded-[var(--radius-control)] shadow-zynd-low"
            disabled={!interactive || !canSubmit || submitting}
            onClick={() => void handleProceed()}
          >
            {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            {copy.mutualFunds.paymentCardRedeemProceed}
          </Button>
        </div>
      </div>
        </div>
      )}
    </>
  );
}
