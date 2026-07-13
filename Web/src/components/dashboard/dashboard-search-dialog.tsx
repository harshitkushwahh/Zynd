"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import {
  fetchInvestSearch,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { resolveInvestAssetUrl } from "@/features/invest/lib/mf-format";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { copy } from "@/shared/config/copy";

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 8;

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: DashboardSearchDialogProps) {
  const router = useRouter();
  const navRoutes = DASHBOARD_ROUTES.filter((route) => route.enabled);
  const [query, setQuery] = useState("");
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const isFundSearch = trimmedQuery.length >= SEARCH_MIN_CHARS;

  const filteredPages = useMemo(() => {
    if (!trimmedQuery) return navRoutes;
    const normalized = trimmedQuery.toLowerCase();
    return navRoutes.filter((route) => {
      const haystack = `${route.label} ${route.description ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [navRoutes, trimmedQuery]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFunds([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isFundSearch) {
      setFunds([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    const timeout = window.setTimeout(() => {
      fetchInvestSearch({ q: trimmedQuery, page: 1, page_size: SEARCH_PAGE_SIZE })
        .then((response) => {
          if (!cancelled) setFunds(response.items);
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setFunds([]);
            setSearchError(error.message || copy.mutualFunds.searchLoadError);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isFundSearch, open, trimmedQuery]);

  const showEmptyState =
    !searching &&
    ((isFundSearch && funds.length === 0 && filteredPages.length === 0) ||
      (!isFundSearch && filteredPages.length === 0));

  const openFund = (productId: string) => {
    router.push(`/dashboard/mutual-funds/funds/${productId}`);
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
            <div className="px-3 py-2 text-caption text-muted-foreground">
              {copy.mutualFunds.searchHint}
            </div>
          ) : null}

          {searching ? (
            <div className="flex items-center gap-2 px-3 py-3 text-caption text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {copy.mutualFunds.searching}
            </div>
          ) : null}

          {searchError ? (
            <div className="px-3 py-2 text-caption text-destructive">{searchError}</div>
          ) : null}

          {isFundSearch && funds.length > 0 ? (
            <CommandGroup heading={copy.dashboard.search.fundsHeading}>
              {funds.map((fund) => {
                const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);

                return (
                  <CommandItem
                    key={fund.product_id}
                    value={fund.product_id}
                    onSelect={() => openFund(fund.product_id)}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt=""
                        className="size-7 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain"
                      />
                    ) : (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                        {fund.amc_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-compact text-foreground">{fund.name}</p>
                      <p className="truncate text-caption text-muted-foreground">{fund.amc_name}</p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {filteredPages.length > 0 ? (
            <CommandGroup heading={copy.dashboard.search.pagesHeading}>
              {filteredPages.map((route) => {
                const Icon = route.icon;

                return (
                  <CommandItem
                    key={route.id}
                    value={route.id}
                    onSelect={() => {
                      router.push(route.href);
                      onOpenChange(false);
                    }}
                  >
                    <Icon />
                    <span>{route.label}</span>
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
      </Command>
    </CommandDialog>
  );
}
