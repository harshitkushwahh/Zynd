"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { MfFundSearchResultItem } from "@/features/invest/components/mf-fund-search-ui";
import { MF_FUND_SEARCH_MIN_CHARS, useMfFundSearch } from "@/features/invest/lib/mf-fund-search";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { RiskProfileSearchResultItem } from "@/features/risk-profile/components/risk-profile-search-result-item";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const RISK_PROFILE_ROUTE = DASHBOARD_ROUTES.find((route) => route.id === "risk-profile");
const RISK_PROFILE_HREF = RISK_PROFILE_ROUTE?.href ?? "/dashboard/risk-profile";

function SearchDialogFooterHint() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
      <span className="truncate">{copy.dashboard.search.footerHint}</span>
      <div className="flex shrink-0 items-center gap-2">
        <kbd className="rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] leading-none">
          ↑↓
        </kbd>
        <kbd className="rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] leading-none">
          ↵
        </kbd>
        <kbd className="rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] leading-none">
          esc
        </kbd>
      </div>
    </div>
  );
}

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: DashboardSearchDialogProps) {
  const router = useRouter();
  const riskProfile = useRiskProfileOptional();
  const navRoutes = useMemo(
    () => DASHBOARD_ROUTES.filter((route) => route.enabled && !route.disabled),
    [],
  );
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const isFundSearch = trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS;
  const hasRiskProfile = Boolean(riskProfile?.hasProfile && riskProfile.profile);

  const { results: funds, searching, error: searchError } = useMfFundSearch({
    query,
    enabled: open && isFundSearch,
  });

  const filteredPages = useMemo(() => {
    if (!trimmedQuery) return navRoutes;
    const normalized = trimmedQuery.toLowerCase();
    return navRoutes.filter((route) => {
      const haystack = `${route.label} ${route.description ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [navRoutes, trimmedQuery]);

  const showRiskProfileCard = useMemo(() => {
    if (!hasRiskProfile || !riskProfile?.profile || !trimmedQuery) return false;
    const normalized = trimmedQuery.toLowerCase();
    const haystack = `${RISK_PROFILE_ROUTE?.label ?? ""} ${RISK_PROFILE_ROUTE?.description ?? ""} risk profile risk appetite`.toLowerCase();
    return haystack.includes(normalized);
  }, [hasRiskProfile, riskProfile?.profile, trimmedQuery]);

  const pagesToShow = useMemo(() => {
    if (!hasRiskProfile) {
      return filteredPages.filter((route) => route.id !== "risk-profile");
    }
    return filteredPages;
  }, [filteredPages, hasRiskProfile]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const showEmptyState =
    !searching &&
    ((isFundSearch && funds.length === 0 && pagesToShow.length === 0 && !showRiskProfileCard) ||
      (!isFundSearch && pagesToShow.length === 0 && !showRiskProfileCard));

  const openFund = (fund: (typeof funds)[number]) => {
    router.push(mfFundHref(fund));
    onOpenChange(false);
  };

  const openRiskProfilePage = () => {
    router.push(RISK_PROFILE_HREF);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.dashboard.search.title}
      description={copy.dashboard.search.description}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={copy.dashboard.search.placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!isFundSearch && trimmedQuery.length > 0 ? (
            <div className="mx-2 mb-1 rounded-xl bg-muted/35 px-3 py-2 text-caption text-muted-foreground ring-1 ring-border/40">
              {copy.mutualFunds.searchHint}
            </div>
          ) : null}

          {searching ? (
            <div className="flex items-center gap-2 px-4 py-4 text-caption text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.mutualFunds.searching}
            </div>
          ) : null}

          {searchError ? (
            <div className="px-4 py-1">
              <FieldMessage message={searchError} className="mt-0" />
            </div>
          ) : null}

          {isFundSearch && funds.length > 0 ? (
            <CommandGroup heading={copy.dashboard.search.fundsHeading} className="px-1">
              {funds.map((fund) => (
                <CommandItem
                  key={fund.product_id}
                  value={fund.product_id}
                  className="px-2.5 py-2.5"
                  onSelect={() => openFund(fund)}
                >
                  <MfFundSearchResultItem fund={fund} />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {showRiskProfileCard && riskProfile?.profile ? (
            <CommandGroup heading={copy.dashboard.search.currentProfileHeading} className="px-1">
              <CommandItem
                value="risk-profile-current"
                className="px-2.5 py-2.5"
                onSelect={openRiskProfilePage}
              >
                <RiskProfileSearchResultItem profile={riskProfile.profile} />
              </CommandItem>
            </CommandGroup>
          ) : null}

          {pagesToShow.length > 0 ? (
            <CommandGroup heading={copy.dashboard.search.pagesHeading} className="px-1">
              {pagesToShow.map((route) => {
                const Icon = route.icon;

                return (
                  <CommandItem
                    key={route.id}
                    value={route.id}
                    className="px-2.5"
                    onSelect={() => {
                      router.push(route.href);
                      onOpenChange(false);
                    }}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-foreground ring-1 ring-border/50">
                      <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{route.label}</span>
                      {route.description ? (
                        <span className="block truncate text-caption text-muted-foreground">
                          {route.description}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {showEmptyState ? (
            <CommandEmpty>
              {isFundSearch ? copy.mutualFunds.searchEmpty : copy.dashboard.search.noPages}
            </CommandEmpty>
          ) : null}
        </CommandList>
        <SearchDialogFooterHint />
      </Command>
    </CommandDialog>
  );
}
