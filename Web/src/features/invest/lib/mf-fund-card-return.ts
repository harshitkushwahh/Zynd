import type { InvestReturns } from "@/features/invest/api/invest-api";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

type FundCardReturnPick = Pick<InvestReturns, "return_3y" | "return_1y" | "return_6m" | "return_1m">;

const FUND_CARD_RETURN_PERIODS: Array<{
  key: keyof FundCardReturnPick;
  label: string;
  shortLabel: string;
}> = [
  { key: "return_3y", label: copy.mutualFunds.fundCardReturn3y, shortLabel: "3Y" },
  { key: "return_1y", label: copy.mutualFunds.fundCardReturn1y, shortLabel: "1Y" },
  { key: "return_6m", label: copy.mutualFunds.fundCardReturn6m, shortLabel: "6M" },
  { key: "return_1m", label: copy.mutualFunds.fundCardReturn1m, shortLabel: "1M" },
];

export type FundCardReturnDisplay = {
  label: string;
  shortLabel: string | null;
  text: string;
  tone: "positive" | "negative" | "muted";
  hasData: boolean;
};

/** Best available trailing return for MF catalog cards (3Y → 1Y → 6M → 1M). */
export function resolveFundCardReturn(returns: FundCardReturnPick): FundCardReturnDisplay {
  for (const period of FUND_CARD_RETURN_PERIODS) {
    const value = returns[period.key];
    if (value == null || Number.isNaN(value)) continue;

    const formatted = formatSignedReturn(value);
    return {
      label: period.label,
      shortLabel: period.shortLabel,
      text: formatted.text,
      tone: formatted.tone,
      hasData: true,
    };
  }

  return {
    label: copy.mutualFunds.fundCardReturnFallback,
    shortLabel: null,
    text: copy.mutualFunds.noReturnData,
    tone: "muted",
    hasData: false,
  };
}
