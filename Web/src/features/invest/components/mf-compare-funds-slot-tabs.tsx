"use client";

import { useState } from "react";

import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundPicker } from "@/features/invest/components/mf-fund-picker";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MF_CALC_PANEL_CLASS } from "@/features/invest/lib/mf-calculator-ui";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SLOT_COUNT = 3;

type CompareFundsSlotTabsProps = {
  slots: Array<InvestFundSummary | null>;
  onSlotsChange: (slots: Array<InvestFundSummary | null>) => void;
  excludeProductIds: string[];
};

type FundSlotTabProps = {
  slotIndex: number;
  fund: InvestFundSummary | null;
  isActive: boolean;
  onSelect: () => void;
};

function FundSlotTab({ slotIndex, fund, isActive, onSelect }: FundSlotTabProps) {
  const return3y = formatSignedReturn(fund?.returns.return_3y);
  const tabLabel = copy.mutualFunds.compareSelectFund.replace("{slot}", String(slotIndex + 1));

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={copy.mutualFunds.compareTabAria(slotIndex + 1)}
      onClick={onSelect}
      className={cn(
        "flex min-w-[8.5rem] flex-1 items-center gap-2 rounded-[var(--radius-control)] border px-2 py-2 text-left transition-colors",
        isActive
          ? "border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))]"
          : "border-[var(--sip-panel-border)] bg-background hover:bg-muted/30",
      )}
    >
      {fund ? (
        <MfFundAmcAvatar amcLogoUrl={fund.amc_logo_url} amcName={fund.amc_name} size="sm" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border bg-muted/20 text-[11px] font-semibold text-muted-foreground">
          {slotIndex + 1}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-medium text-foreground">{tabLabel}</span>
        <span
          className={cn(
            "block truncate text-[10px] tabular-nums",
            fund ? "text-muted-foreground" : "text-muted-foreground/70",
          )}
        >
          {fund ? fund.name : copy.mutualFunds.compareAddFund}
        </span>
      </span>
      {fund ? (
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold tabular-nums",
            return3y.tone === "positive" && "text-success",
            return3y.tone === "negative" && "text-destructive",
            return3y.tone === "muted" && "text-muted-foreground",
          )}
        >
          {return3y.text}
        </span>
      ) : null}
    </button>
  );
}

export function CompareFundsSlotTabs({
  slots,
  onSlotsChange,
  excludeProductIds,
}: CompareFundsSlotTabsProps) {
  const [activeSlot, setActiveSlot] = useState(0);

  const activeFund = slots[activeSlot] ?? null;
  const pickerExclude = excludeProductIds.filter((id) => id !== activeFund?.product_id);

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label={copy.mutualFunds.compareSelectTitle}
        className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
      >
        {Array.from({ length: SLOT_COUNT }, (_, index) => (
          <FundSlotTab
            key={index}
            slotIndex={index}
            fund={slots[index] ?? null}
            isActive={activeSlot === index}
            onSelect={() => setActiveSlot(index)}
          />
        ))}
      </div>

      <div className={cn(MF_CALC_PANEL_CLASS, "space-y-3")}>
        <p className="text-caption font-medium text-foreground">
          {copy.mutualFunds.compareSelectFund.replace("{slot}", String(activeSlot + 1))}
        </p>

        <MfFundPicker
          value={activeFund}
          onChange={(fund) => {
            onSlotsChange(slots.map((slot, index) => (index === activeSlot ? fund : slot)));
          }}
          excludeProductIds={pickerExclude}
          className="w-full"
        />
      </div>
    </div>
  );
}
