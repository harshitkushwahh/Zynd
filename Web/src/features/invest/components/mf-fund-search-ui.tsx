"use client";

import { Loader2, Search } from "lucide-react";

import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MF_FUND_SEARCH_MIN_CHARS } from "@/features/invest/lib/mf-fund-search";
import { formatSignedReturn, resolveInvestAssetUrl } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundAmcAvatarProps = {
  amcLogoUrl: string | null;
  amcName: string;
  size?: "sm" | "md";
  className?: string;
};

export function MfFundAmcAvatar({
  amcLogoUrl,
  amcName,
  size = "md",
  className,
}: MfFundAmcAvatarProps) {
  const logoUrl = resolveInvestAssetUrl(amcLogoUrl);
  const sizeClass = size === "sm" ? "size-7 text-[10px]" : "size-8 text-[10px]";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted font-semibold text-muted-foreground",
        sizeClass,
        className,
      )}
    >
      {amcName.slice(0, 2).toUpperCase()}
    </div>
  );
}

type MfFundSearchResultItemProps = {
  fund: InvestFundSummary;
  showReturn?: boolean;
  className?: string;
};

export function MfFundSearchResultItem({
  fund,
  showReturn = true,
  className,
}: MfFundSearchResultItemProps) {
  const return3y = formatSignedReturn(fund.returns.return_3y);

  return (
    <div className={cn("flex min-w-0 flex-1 items-start gap-3", className)}>
      <MfFundAmcAvatar amcLogoUrl={fund.amc_logo_url} amcName={fund.amc_name} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug text-foreground">{fund.name}</p>
        <p className="truncate text-caption text-muted-foreground">{fund.amc_name}</p>
      </div>
      {showReturn ? (
        <span
          className={cn(
            "shrink-0 self-center text-caption font-semibold tabular-nums",
            return3y.tone === "positive" && "text-success",
            return3y.tone === "negative" && "text-destructive",
            return3y.tone === "muted" && "text-muted-foreground",
          )}
        >
          3Y {return3y.text}
        </span>
      ) : null}
    </div>
  );
}

type MfFundSearchListProps = {
  query: string;
  onQueryChange: (query: string) => void;
  results: InvestFundSummary[];
  searching: boolean;
  error?: string | null;
  onSelect: (fund: InvestFundSummary) => void;
  inputPlaceholder?: string;
  listClassName?: string;
};

export function MfFundSearchList({
  query,
  onQueryChange,
  results,
  searching,
  error = null,
  onSelect,
  inputPlaceholder = copy.mutualFunds.calculatorSearchPlaceholder,
  listClassName,
}: MfFundSearchListProps) {
  const trimmedQuery = query.trim();
  const showHint = !searching && trimmedQuery.length < MF_FUND_SEARCH_MIN_CHARS;
  const showEmpty = !searching && trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS && results.length === 0;

  return (
    <>
      <CommandInput placeholder={inputPlaceholder} value={query} onValueChange={onQueryChange} />
      <CommandList className={cn("max-h-80", listClassName)}>
        {searching ? (
          <div className="flex items-center gap-2 px-4 py-5 text-compact text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.mutualFunds.searching}
          </div>
        ) : null}

        {error ? (
          <div className="px-4 py-3 text-caption text-destructive">{error}</div>
        ) : null}

        {showHint ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-4" />
            </span>
            <div>
              <p className="text-compact font-medium text-foreground">{inputPlaceholder}</p>
              <p className="mt-1 text-caption text-muted-foreground">{copy.mutualFunds.searchHint}</p>
            </div>
          </div>
        ) : null}

        {showEmpty ? <CommandEmpty>{copy.mutualFunds.calculatorSearchEmpty}</CommandEmpty> : null}

        {results.length > 0 ? (
          <CommandGroup className="p-1.5">
            {results.map((fund) => (
              <CommandItem
                key={fund.product_id}
                value={fund.product_id}
                className="py-2.5"
                onSelect={() => onSelect(fund)}
              >
                <MfFundSearchResultItem fund={fund} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </>
  );
}
