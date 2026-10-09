"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronsUpDown, Info, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldMessage } from "@/components/ui/ui-message";
import { MfSipDayPicker } from "@/features/invest/components/mf-sip-day-picker";
import { MfSipInstallmentsInput } from "@/features/invest/components/mf-sip-installments-input";
import {
  RedeemBankRow,
  RedeemValueInput,
  type MfRedeemInputMode,
} from "@/features/invest/components/mf-invest-payment-card-redeem";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { amcSlugFromLogoUrl, formatInr } from "@/features/invest/lib/mf-format";
import { ApiError } from "@/lib/api-client";
import {
  createMfStpPlan,
  createMfSwitch,
  createMfSwpPlan,
  fetchMfSwitchDestinations,
  type MfSwitchDestination,
  type MfSwitchOrder,
  type MfSystematicPlan,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import type { PortfolioHoldingDetail } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type HoldingActionMode = "switch" | "stp" | "swp";

type PortfolioHoldingActionPanelProps = {
  holding: PortfolioHoldingDetail;
  mode: HoldingActionMode;
  className?: string;
  onSwitchCreated: (order: MfSwitchOrder) => void;
  onPlanCreated: (kind: "swp" | "stp", plan: MfSystematicPlan) => void;
  onBack?: () => void;
};

const CLOSED_MATURITY_FUND_RE =
  /\bfmp\b|fixed maturity|close[- ]?ended|closed[- ]?ended|interval fund|interval scheme|annual interval/i;

function isOpenEndedSwitchDestination(destination: MfSwitchDestination) {
  return !CLOSED_MATURITY_FUND_RE.test(`${destination.name} ${destination.isin}`);
}

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

function formatUnitDigits(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function FundDestinationOption({ destination }: { destination: MfSwitchDestination }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <MfFundAmcAvatar
        amcLogoUrl={destination.amc_logo_url}
        amcSlug={destination.amc_slug}
        amcName={destination.amc_name?.trim() || destination.name}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="whitespace-normal break-words text-compact font-medium leading-snug text-foreground">
          {destination.name}
        </p>
        <p className="mt-0.5 font-mono text-caption tracking-wide text-muted-foreground">{destination.isin}</p>
      </div>
    </div>
  );
}

function FundDestinationPicker({
  destinations,
  selectedId,
  onSelect,
  loading,
  emptyLabel,
  label,
}: {
  destinations: MfSwitchDestination[];
  selectedId: string;
  onSelect: (productId: string) => void;
  loading: boolean;
  emptyLabel: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected =
    destinations.find((item) => item.product_id === selectedId) ?? destinations[0] ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((destination) => {
      return (
        destination.name.toLowerCase().includes(needle) ||
        destination.isin.toLowerCase().includes(needle)
      );
    });
  }, [destinations, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-2.5 text-compact text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {copy.dashboard.portfolio.holdingActionLoadingFunds}
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border/80 px-3.5 py-2.5 text-compact text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  if (destinations.length === 1 && selected) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-2.5">
        <p className="mb-2 text-caption font-medium text-muted-foreground">{label}</p>
        <FundDestinationOption destination={selected} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className={cn(
            "flex w-full min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-border/80 bg-muted/15 px-3.5 py-2.5 text-left",
            "hover:bg-muted/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            open && "border-ring ring-[3px] ring-ring/50",
          )}
        >
          {selected ? <FundDestinationOption destination={selected} /> : null}
          <ChevronsUpDown className="mt-2 size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--anchor-width) min-w-(--anchor-width) overflow-hidden rounded-[var(--radius-card)] border border-border p-0 shadow-zynd-mid"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={copy.dashboard.portfolio.holdingActionSearchFunds}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>{copy.dashboard.portfolio.holdingActionNoSearchMatches}</CommandEmpty>
              <CommandGroup>
                {filtered.map((destination) => (
                  <CommandItem
                    key={destination.product_id}
                    value={destination.product_id}
                    className="items-start gap-3 py-2.5"
                    onSelect={() => {
                      onSelect(destination.product_id);
                      handleOpenChange(false);
                    }}
                  >
                    <FundDestinationOption destination={destination} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PortfolioHoldingActionPanel({
  holding,
  mode,
  className,
  onSwitchCreated,
  onPlanCreated,
  onBack,
}: PortfolioHoldingActionPanelProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const [destinations, setDestinations] = useState<MfSwitchDestination[]>([]);
  const [loadingDest, setLoadingDest] = useState(mode !== "swp");
  const [destId, setDestId] = useState("");
  const [inputMode, setInputMode] = useState<MfRedeemInputMode>("amount");
  const [amount, setAmount] = useState(0);
  const [units, setUnits] = useState(0);
  const [useAll, setUseAll] = useState(false);
  const [installmentDay, setInstallmentDay] = useState(1);
  const [installments, setInstallments] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxAmount = roundAmount(
    holding.redeemableUnits > 0 && holding.currentNav > 0
      ? holding.redeemableUnits * holding.currentNav
      : holding.currentValueInr,
  );
  const maxUnits = roundUnits(holding.redeemableUnits);
  const needsDestination = mode !== "swp";
  const titleVerb =
    mode === "switch"
      ? portfolioCopy.holdingActionSwitch
      : mode === "stp"
        ? portfolioCopy.holdingActionStp
        : portfolioCopy.holdingActionSwp;

  useEffect(() => {
    if (!needsDestination) return;
    let cancelled = false;
    setLoadingDest(true);
    fetchMfSwitchDestinations(holding.id)
      .then((payload) => {
        if (cancelled) return;
        const amcSlug = holding.amcSlug || amcSlugFromLogoUrl(holding.amcLogoUrl);
        const destinations = payload.destinations
          .map((destination) => ({
            ...destination,
            amc_name: destination.amc_name || holding.amcName,
            amc_slug: destination.amc_slug || amcSlug,
            amc_logo_url: destination.amc_logo_url || holding.amcLogoUrl,
          }))
          .filter(isOpenEndedSwitchDestination);
        setDestinations(destinations);
        setDestId((current) =>
          destinations.some((destination) => destination.product_id === current)
            ? current
            : destinations[0]?.product_id || "",
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : portfolioCopy.holdingActionLoadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDest(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    holding.amcLogoUrl,
    holding.amcName,
    holding.amcSlug,
    holding.id,
    needsDestination,
    portfolioCopy.holdingActionLoadFailed,
  ]);

  useEffect(() => {
    if (!useAll) return;
    setAmount(maxAmount);
    setUnits(maxUnits);
  }, [maxAmount, maxUnits, useAll]);

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
      return `Maximum is ${formatUnitDigits(maxUnits)} units`;
    }
    return null;
  }, [maxUnits, units]);

  const fieldError = mode === "switch" && inputMode === "units" ? unitsError : amountError;
  const canSubmitValue =
    mode === "switch" && inputMode === "units" ? units > 0 && !unitsError : amount > 0 && !amountError;
  const canSubmit = canSubmitValue && (mode === "swp" || Boolean(destId));

  function handleAmountChange(nextAmount: number) {
    setError(null);
    setUseAll(nextAmount >= maxAmount);
    setAmount(nextAmount);
    setUnits(amountToUnits(nextAmount, holding.currentNav));
  }

  function handleUnitsChange(nextUnits: number) {
    setError(null);
    setUseAll(nextUnits >= maxUnits);
    setUnits(nextUnits);
    setAmount(unitsToAmount(nextUnits, holding.currentNav));
  }

  async function handleSubmit() {
    if (!canSubmit) {
      if (needsDestination && !destId) setError(portfolioCopy.holdingActionDestinationRequired);
      else if (!canSubmitValue) setError(portfolioCopy.holdingActionAmountRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "switch") {
        const switchMode = useAll ? "all" : inputMode === "units" ? "units" : "amount";
        const order = await createMfSwitch({
          holding_id: holding.id,
          switch_in_product_id: destId,
          idempotency_key: crypto.randomUUID(),
          switch_mode: switchMode,
          amount_inr: switchMode === "amount" ? amount : undefined,
          units: switchMode === "units" ? units : undefined,
        });
        onSwitchCreated(order);
      } else if (mode === "swp") {
        const plan = await createMfSwpPlan({
          holding_id: holding.id,
          idempotency_key: crypto.randomUUID(),
          amount_inr: amount,
          installment_day: installmentDay,
          number_of_installments: installments,
        });
        onPlanCreated("swp", plan);
      } else {
        const plan = await createMfStpPlan({
          holding_id: holding.id,
          switch_in_product_id: destId,
          idempotency_key: crypto.randomUUID(),
          amount_inr: amount,
          installment_day: installmentDay,
          number_of_installments: installments,
        });
        onPlanCreated("stp", plan);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : portfolioCopy.holdingActionSubmitFailed;
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const transferBy = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className={cn("flex min-h-full flex-1 flex-col", className)}>
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
            <p className="line-clamp-2 min-w-0 flex-1 text-compact font-semibold leading-snug text-foreground">
              {titleVerb} {holding.fundName}
            </p>
            {mode === "switch" ? (
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
                    onValueChange={(value) => setInputMode(value as MfRedeemInputMode)}
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-8 px-4 pt-6 pb-7">
        <div className="space-y-5">
          <div className="space-y-2">
            <RedeemValueInput
              mode={mode === "switch" ? inputMode : "amount"}
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
                  {mode === "switch" && inputMode === "units"
                    ? copy.mutualFunds.paymentCardRedeemUnitsAvailable.replace(
                        "{units}",
                        formatUnitDigits(maxUnits),
                      )
                    : copy.mutualFunds.paymentCardRedeemAvailable.replace("{amount}", formatInr(maxAmount))}
                  <Info className="size-3 opacity-70" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[15rem] text-pretty">
                  {copy.mutualFunds.paymentCardRedeemAvailableTooltip}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {mode === "switch" ? (
            <label className="flex cursor-pointer items-center justify-center gap-2.5">
              <input
                type="checkbox"
                checked={useAll}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setUseAll(checked);
                  if (!checked) {
                    setAmount(0);
                    setUnits(0);
                    return;
                  }
                  setAmount(maxAmount);
                  setUnits(maxUnits);
                }}
                className="size-4 rounded-[4px] border-border accent-success"
              />
              <span className="text-compact font-medium text-foreground">
                {portfolioCopy.holdingActionSwitchAll}
              </span>
            </label>
          ) : null}
        </div>

        <div className="mt-auto space-y-4 pt-5">
          {mode !== "switch" ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <MfSipDayPicker
                compact
                className="w-full"
                label={mode === "swp" ? portfolioCopy.holdingActionSwpDate : portfolioCopy.holdingActionStpDate}
                value={installmentDay}
                onChange={setInstallmentDay}
                disabled={submitting}
              />
              <MfSipInstallmentsInput compact value={installments} onChange={setInstallments} disabled={submitting} />
            </div>
          ) : null}

          {mode !== "swp" ? (
            <FundDestinationPicker
              destinations={destinations}
              selectedId={destId}
              onSelect={setDestId}
              loading={loadingDest}
              emptyLabel={portfolioCopy.holdingActionNoDestinations}
              label={
                mode === "stp" ? portfolioCopy.holdingActionStpInto : portfolioCopy.holdingActionSwitchInto
              }
            />
          ) : (
            <RedeemBankRow
              label={holding.redeemBankLabel ?? copy.mutualFunds.paymentCardPreviewBankLabel}
              expectedTransferBy={transferBy}
              bankName={holding.redeemBankName}
              ifscCode={holding.redeemBankIfsc}
            />
          )}

          {error ? <FieldMessage message={error} /> : null}

          <Button
            className="h-10 w-full rounded-[var(--radius-control)] shadow-zynd-low"
            disabled={submitting || !canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            {portfolioCopy.holdingActionProceed}
          </Button>
        </div>
      </div>
    </div>
  );
}
