"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { MfFundSearchResultItem } from "@/features/invest/components/mf-fund-search-ui";
import { MF_FUND_SEARCH_MIN_CHARS, useMfFundSearch } from "@/features/invest/lib/mf-fund-search";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
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

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: DashboardSearchDialogProps) {
  const router = useRouter();
  const navRoutes = DASHBOARD_ROUTES.filter((route) => route.enabled && !route.disabled);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const isFundSearch = trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS;

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

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const showEmptyState =
    !searching &&
    ((isFundSearch && funds.length === 0 && filteredPages.length === 0) ||
      (!isFundSearch && filteredPages.length === 0));

  const openFund = (fund: (typeof funds)[number]) => {
    router.push(mfFundHref(fund));
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
            <div className="px-3 py-1">
              <FieldMessage message={searchError} className="mt-0" />
            </div>
          ) : null}

          {isFundSearch && funds.length > 0 ? (
            <CommandGroup heading={copy.dashboard.search.fundsHeading} className="p-1.5">
              {funds.map((fund) => (
                <CommandItem
                  key={fund.product_id}
                  value={fund.product_id}
                  className="py-2.5"
                  onSelect={() => openFund(fund)}
                >
                  <MfFundSearchResultItem fund={fund} />
                </CommandItem>
              ))}
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
