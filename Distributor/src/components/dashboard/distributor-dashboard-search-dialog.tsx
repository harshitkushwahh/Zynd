"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchDistributorClients } from "@/lib/distributor-clients-api";
import { distributorOperationsSectionHref } from "@/lib/distributor-operations-sections";
import {
  getInvestorListHref,
  searchDistributorInvestorsInList,
  searchDistributorOrders,
  searchDistributorPages,
  searchDistributorSystematicPlans,
  searchDistributorTransactionGroups,
  searchDistributorTxnRequests,
} from "@/lib/distributor-global-search";
import { env } from "@/lib/env";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorInvestor } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type DistributorDashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SearchResultButton({
  title,
  subtitle,
  meta,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-compact font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="block truncate text-caption text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-caption text-muted-foreground">{meta}</span>
      ) : null}
    </button>
  );
}

function SearchGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-caption font-medium text-muted-foreground">{heading}</p>
      <div className="px-1">{children}</div>
    </div>
  );
}

export function DistributorDashboardSearchDialog({
  open,
  onOpenChange,
}: DistributorDashboardSearchDialogProps) {
  const router = useRouter();
  const { requests: txnRequestItems } = useDistributorTxnRequests();
  const [query, setQuery] = useState("");
  const [apiClients, setApiClients] = useState<DistributorInvestor[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchDistributorClients({ limit: 100 })
      .then((items) => {
        if (!cancelled) setApiClients(items);
      })
      .catch(() => {
        if (!cancelled) setApiClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pages = useMemo(() => searchDistributorPages(query), [query]);
  const investors = useMemo(
    () => searchDistributorInvestorsInList(apiClients ?? [], query),
    [query, apiClients],
  );
  const orders = useMemo(() => searchDistributorOrders(query), [query]);
  const plans = useMemo(() => searchDistributorSystematicPlans(query), [query]);
  const txnRequests = useMemo(
    () => searchDistributorTxnRequests(query, txnRequestItems),
    [query, txnRequestItems],
  );
  const groups = useMemo(() => searchDistributorTransactionGroups(query), [query]);

  const trimmedQuery = query.trim();
  const hasResults =
    pages.length > 0 ||
    investors.length > 0 ||
    orders.length > 0 ||
    plans.length > 0 ||
    txnRequests.length > 0 ||
    groups.length > 0;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
    }
    onOpenChange(next);
  };

  const navigate = (href: string) => {
    setQuery("");
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{ZYND_MITRA_COPY.searchTitle}</DialogTitle>
        <DialogDescription>
          Search console pages and demo investor or order records.
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        className="top-[18%] max-w-lg -translate-y-0 gap-0 p-0"
        showCloseButton={false}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, client codes, orders..."
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-scroll-md overflow-y-auto p-2">
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-compact text-muted-foreground">
              {trimmedQuery
                ? "No pages or demo records match your search."
                : "Type to search pages and demo data."}
            </p>
          ) : null}

          {pages.length > 0 ? (
            <SearchGroup heading="Pages">
              {pages.map((route) => {
                const Icon = route.icon;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => navigate(route.href)}
                    className="flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-compact font-medium text-foreground">
                        {route.label}
                      </span>
                      <span className="block text-caption text-muted-foreground">
                        {route.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </SearchGroup>
          ) : null}

          {investors.length > 0 ? (
            <SearchGroup heading="Clients">
              {investors.map((investor) => (
                <SearchResultButton
                  key={investor.id}
                  title={investor.clientCode}
                  subtitle={`${investor.emailMasked} · ${investor.panMasked}`}
                  meta={investor.investorType}
                  onClick={() => navigate(getInvestorListHref(investor))}
                />
              ))}
            </SearchGroup>
          ) : null}

          {orders.length > 0 ? (
            <SearchGroup heading="Orders">
              {orders.map((order) => (
                <SearchResultButton
                  key={order.id}
                  title={order.orderRef}
                  subtitle={order.schemeName}
                  meta={order.clientCode}
                  onClick={() => navigate(distributorOperationsSectionHref("orders"))}
                />
              ))}
            </SearchGroup>
          ) : null}

          {plans.length > 0 ? (
            <SearchGroup heading="Systematic plans">
              {plans.map((plan) => (
                <SearchResultButton
                  key={plan.id}
                  title={plan.planRef}
                  subtitle={plan.schemeName}
                  meta={plan.planType}
                  onClick={() => navigate(distributorOperationsSectionHref("systematic-plans"))}
                />
              ))}
            </SearchGroup>
          ) : null}

          {txnRequests.length > 0 ? (
            <SearchGroup heading="Txn requests">
              {txnRequests.map((request) => (
                <SearchResultButton
                  key={request.id}
                  title={request.requestRef}
                  subtitle={request.requestType}
                  meta={request.clientCode}
                  onClick={() => navigate(distributorOperationsSectionHref("txn-requests"))}
                />
              ))}
            </SearchGroup>
          ) : null}

          {groups.length > 0 ? (
            <SearchGroup heading="Transaction groups">
              {groups.map((group) => (
                <SearchResultButton
                  key={group.id}
                  title={group.groupRef}
                  subtitle={group.label}
                  meta={group.status}
                  onClick={() => navigate(distributorOperationsSectionHref("transaction-groups"))}
                />
              ))}
            </SearchGroup>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
