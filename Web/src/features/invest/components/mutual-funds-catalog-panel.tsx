"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import {
  fetchInvestFunds,
  fetchInvestHome,
  fetchInvestSearch,
  type InvestCategory,
  type InvestFundSummary,
  type InvestHomeResponse,
} from "@/features/invest/api/invest-api";
import { MfFundCard } from "@/features/invest/components/mf-fund-card";
import { MfFundDetailView } from "@/features/invest/components/mf-fund-detail-view";
import { MfHoldingsSection } from "@/features/invest/components/mf-holdings-section";
import { MfOrdersSection } from "@/features/invest/components/mf-orders-section";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type TopTab = "browse" | "orders" | "holdings";

type BrowseView =
  | { kind: "home" }
  | { kind: "category"; slug: string; name: string }
  | { kind: "detail"; productId: string };

const route = DASHBOARD_ROUTES.find((item) => item.id === "mutual-funds")!;

function CategoryChip({
  category,
  active,
  onSelect,
}: {
  category: InvestCategory;
  active: boolean;
  onSelect: (slug: string, name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.slug, category.name)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-compact transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <span>{category.name}</span>
      <span className="text-caption">{category.fund_count}</span>
    </button>
  );
}

function FeaturedCarousel({
  funds,
  onSelectFund,
}: {
  funds: InvestFundSummary[];
  onSelectFund: (productId: string) => void;
}) {
  if (funds.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.mutualFunds.featuredTitle}</CardTitle>
        <CardDescription>{copy.mutualFunds.featuredDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {funds.map((fund) => (
            <div key={fund.product_id} className="w-[min(100%,280px)] shrink-0">
              <MfFundCard fund={fund} onSelect={onSelectFund} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryBrowse({
  slug,
  name,
  onSelectFund,
}: {
  slug: string;
  name: string;
  onSelectFund: (productId: string) => void;
}) {
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const response = await fetchInvestFunds({
          category: slug,
          page: nextPage,
          page_size: 12,
        });
        setFunds((current) => (append ? [...current, ...response.items] : response.items));
        setPage(response.page);
        setHasMore(response.has_more);
        setTotal(response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.mutualFunds.categoryLoadError);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h3 font-semibold text-foreground">{name}</h2>
        <p className="mt-1 text-compact text-muted-foreground">
          {loading ? copy.mutualFunds.loadingCategory : copy.mutualFunds.categoryFundCount.replace("{count}", String(total))}
        </p>
      </div>

      {error ? <FieldMessage variant="error" message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.loadingFunds}
        </div>
      ) : null}

      {!loading && !error && funds.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.categoryEmpty}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {funds.map((fund) => (
          <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
        ))}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled={loadingMore} onClick={() => void loadPage(page + 1, true)}>
            {loadingMore ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {copy.mutualFunds.loadingMore}
              </>
            ) : (
              copy.mutualFunds.loadMore
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FundSearchResults({
  query,
  onSelectFund,
}: {
  query: string;
  onSelectFund: (productId: string) => void;
}) {
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setFunds([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchInvestSearch({ q: query.trim(), page: 1, page_size: 12 })
        .then((response) => {
          if (cancelled) return;
          setFunds(response.items);
          setTotal(response.total);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message || copy.mutualFunds.searchLoadError);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  if (query.trim().length < 2) {
    return (
      <p className="text-caption text-muted-foreground">{copy.mutualFunds.searchHint}</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-compact text-muted-foreground">
        {loading
          ? copy.mutualFunds.searching
          : copy.mutualFunds.searchResultsCount
              .replace("{count}", String(total))
              .replace("{query}", query.trim())}
      </p>
      {error ? <FieldMessage variant="error" message={error} /> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.searching}
        </div>
      ) : null}
      {!loading && !error && funds.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.searchEmpty}</p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {funds.map((fund) => (
          <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
        ))}
      </div>
    </div>
  );
}

function BrowseHome({
  data,
  loading,
  error,
  activeCategorySlug,
  searchQuery,
  onSearchQueryChange,
  onSelectCategory,
  onSelectFund,
}: {
  data: InvestHomeResponse | null;
  loading: boolean;
  error: string | null;
  activeCategorySlug: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectCategory: (slug: string, name: string) => void;
  onSelectFund: (productId: string) => void;
}) {
  const Icon = route.icon;
  const searchActive = searchQuery.trim().length >= 2;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" strokeWidth={2.25} />
            {copy.mutualFunds.catalogTitle}
          </CardTitle>
          <CardDescription>
            {loading
              ? copy.mutualFunds.loadingCatalog
              : copy.mutualFunds.catalogDescription.replace(
                  "{count}",
                  String(data?.total_active_funds ?? 0),
                )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={copy.mutualFunds.searchPlaceholder}
              className="pl-9"
              aria-label={copy.mutualFunds.searchPlaceholder}
            />
          </div>

          {searchActive ? (
            <FundSearchResults query={searchQuery} onSelectFund={onSelectFund} />
          ) : (
            <>
              {error ? <FieldMessage variant="error" message={error} /> : null}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data?.categories.map((category) => (
                  <CategoryChip
                    key={category.id}
                    category={category}
                    active={activeCategorySlug === category.slug}
                    onSelect={onSelectCategory}
                  />
                ))}
              </div>
              {!loading && !error && data?.categories.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
                  <p className="text-compact text-muted-foreground">{copy.mutualFunds.catalogEmpty}</p>
                </div>
              ) : null}
              {data?.categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.slug, category.name)}
                  className="flex w-full items-center justify-between rounded-[var(--radius-card)] border border-border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-card/90"
                >
                  <div>
                    <p className="font-medium text-foreground">{category.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {copy.mutualFunds.categoryFundCount.replace("{count}", String(category.fund_count))}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {!searchActive && data ? (
        <FeaturedCarousel funds={data.featured_funds} onSelectFund={onSelectFund} />
      ) : null}
    </div>
  );
}

export function MutualFundsCatalogPanel() {
  const [topTab, setTopTab] = useState<TopTab>("browse");
  const [browseView, setBrowseView] = useState<BrowseView>({ kind: "home" });
  const [homeData, setHomeData] = useState<InvestHomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setHomeLoading(true);
    fetchInvestHome()
      .then((response) => {
        if (!cancelled) setHomeData(response);
      })
      .catch((err: Error) => {
        if (!cancelled) setHomeError(err.message || copy.mutualFunds.catalogLoadError);
      })
      .finally(() => {
        if (!cancelled) setHomeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openCategory(slug: string, name: string) {
    setBrowseView({ kind: "category", slug, name });
  }

  function openFund(productId: string) {
    setBrowseView({ kind: "detail", productId });
  }

  function backToHome() {
    setBrowseView({ kind: "home" });
  }

  const activeCategorySlug =
    browseView.kind === "category" ? browseView.slug : null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-h2 font-bold text-foreground">{route.label}</h1>
        <p className="mt-2 text-compact text-muted-foreground">{route.description}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["browse", copy.mutualFunds.tabBrowse],
            ["orders", copy.mutualFunds.tabOrders],
            ["holdings", copy.mutualFunds.tabHoldings],
          ] as const
        ).map(([tab, label]) => (
          <Button
            key={tab}
            variant={topTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setTopTab(tab)}
          >
            {label}
          </Button>
        ))}
      </div>

      {topTab === "browse" ? (
        browseView.kind === "detail" ? (
          <MfFundDetailView
            productId={browseView.productId}
            onBack={backToHome}
            onOrderPlaced={() => setTopTab("orders")}
          />
        ) : browseView.kind === "category" ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={backToHome} className="-ml-2">
              {copy.mutualFunds.backToBrowse}
            </Button>
            <CategoryBrowse
              slug={browseView.slug}
              name={browseView.name}
              onSelectFund={openFund}
            />
          </div>
        ) : (
          <BrowseHome
            data={homeData}
            loading={homeLoading}
            error={homeError}
            activeCategorySlug={activeCategorySlug}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSelectCategory={openCategory}
            onSelectFund={openFund}
          />
        )
      ) : null}

      {topTab === "orders" ? <MfOrdersSection /> : null}
      {topTab === "holdings" ? <MfHoldingsSection /> : null}
    </div>
  );
}
