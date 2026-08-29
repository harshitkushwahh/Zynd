"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Activity,
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  Circle,
  Gauge,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserSearch,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/lib/api-client";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AmcLogo } from "@/components/mf/amc-logo";
import { RiskProfileTierBadge } from "@/components/risk-profile/risk-profile-tier-badge";
import { AdminUserProfileAvatar } from "@/components/users/admin-user-profile-avatar";
import { AdminConfirmDialog, AdminDialogFooterActions, AdminFormDialog } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import {
  AdminCardListSkeleton,
  AdminFormSkeleton,
  AdminRecommendationsPageSkeleton,
  AdminTableSkeleton,
  AdminTableSkeletonRows,
} from "@/components/ui/admin-skeletons";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  ADMIN_TABLE_PAGE_SIZE,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  useRecommendationBasketDetailQuery,
  useRecommendationBasketsQuery,
  useRecommendationConfigQuery,
  useRecommendationMetricsQuery,
  useRecommendationMutations,
  useRecommendationPreviewQuery,
  useRecommendationPublishReadinessQuery,
} from "@/hooks/use-recommendation-baskets-queries";
import { searchAdmin } from "@/lib/admin-search-api";
import { fetchMfFunds, type MfFundAdmin } from "@/lib/mf-admin-api";
import {
  RECOMMENDATION_RISK_TIERS,
  type RecommendationBasket,
  type RecommendationBasketFund,
  type RecommendationPreview,
  type RecommendationPreviewAllocationSlice,
  type RecommendationPreviewFund,
  type RecommendationPublishReadiness,
  type RiskTierId,
} from "@/lib/recommendations-admin-api";
import { resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { resolveRiskTierBadgeVariant } from "@/lib/risk-tier-admin-ui";
import { cn } from "@/lib/utils";

const MIN_POOL_FUNDS = 5;
const FUND_POOL_VISIBLE_ROWS = 5;
const FUND_POOL_ROW_MIN_HEIGHT = "4.75rem";
const FUND_POOL_TABLE_MAX_HEIGHT = `calc(3rem + ${FUND_POOL_VISIBLE_ROWS} * ${FUND_POOL_ROW_MIN_HEIGHT})`;
const MAX_POOL_FUNDS = 15;
const MAX_BASKETS_PER_TIER = 3;
const INVESTOR_FUNDS_PER_BASKET = 5;

function draftBasketFundFromCatalog(fund: MfFundAdmin, sortOrder: number): RecommendationBasketFund {
  return {
    id: `draft-${fund.product_id}`,
    product_id: fund.product_id!,
    sort_order: sortOrder,
    allocation_weight_pct: null,
    portfolio_role: null,
    is_anchor: false,
    is_alternative: false,
    alternative_for_product_id: null,
    is_active: true,
    fund_id: fund.fund_id,
    scheme_name: fund.scheme_name,
    amc_name: fund.amc_name,
    amc_slug: fund.amc_slug,
    amc_logo_url: fund.amc_logo_url,
    lifecycle_status: fund.lifecycle_status,
    fund_active: fund.fund_active,
    amc_empanelled: fund.amc_empanelled,
  };
}

function recommendationBasketDisplayName(
  basket: Pick<RecommendationBasket, "display_name" | "portfolio_display_name" | "name">,
) {
  return basket.display_name?.trim() || basket.portfolio_display_name?.trim() || basket.name;
}

function AdminPanelCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: typeof Layers3;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-border bg-card", className)}>
      <div
        className={cn(
          "flex flex-wrap justify-between gap-3 border-b border-border bg-muted/15 px-5 py-4",
          description ? "items-start" : "items-center",
        )}
      >
        <AdminSectionTitle icon={Icon} variant="section" description={description}>
          {title}
        </AdminSectionTitle>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function AdminPanelEmptyState({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center py-empty-state-lg text-center">
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-compact font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function RecommendationTierSelector({
  value,
  onValueChange,
  className,
  trailing,
}: {
  value: RiskTierId;
  onValueChange: (tier: RiskTierId) => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Risk tier">
        {RECOMMENDATION_RISK_TIERS.map((tier) => {
          const isActive = tier.id === value;
          const tierVisual = resolveRiskTierVisual(tier.id);

          return (
            <button
              key={tier.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onValueChange(tier.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "shadow-xs"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
              style={
                isActive
                  ? {
                      borderColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 50%, var(--border))`,
                      backgroundColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 10%, var(--card))`,
                      color: tierVisual.gaugeColor,
                    }
                  : undefined
              }
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tierVisual.gaugeColor }}
                aria-hidden
              />
              {tier.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

type FundPickerState = {
  query: string;
  results: MfFundAdmin[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

function sortTierBaskets(baskets: RecommendationBasket[]) {
  return [...baskets].sort((left, right) => {
    if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
    return left.sort_order - right.sort_order;
  });
}

function basketNeedsMoreFunds(basket: RecommendationBasket | null | undefined) {
  if (!basket) return false;
  return basket.fund_count < MIN_POOL_FUNDS;
}

function FundPickerDialog({
  open,
  onClose,
  onSelect,
  excludedProductIds,
  currentPoolCount,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (funds: MfFundAdmin[]) => void;
  excludedProductIds: Set<string>;
  currentPoolCount: number;
}) {
  const [picker, setPicker] = useState<FundPickerState>({
    query: "",
    results: [],
    loading: false,
    page: 0,
    pageSize: ADMIN_TABLE_PAGE_SIZE,
    total: 0,
    hasMore: false,
  });
  const [selectedFundsByProductId, setSelectedFundsByProductId] = useState<Map<string, MfFundAdmin>>(
    () => new Map(),
  );

  const remainingSlots = Math.max(0, MAX_POOL_FUNDS - currentPoolCount);
  const selectedCount = selectedFundsByProductId.size;
  const slotsLeft = Math.max(0, remainingSlots - selectedCount);
  const selectedFunds = useMemo(
    () => Array.from(selectedFundsByProductId.values()),
    [selectedFundsByProductId],
  );

  useEffect(() => {
    if (!open) {
      setPicker({
        query: "",
        results: [],
        loading: false,
        page: 0,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        total: 0,
        hasMore: false,
      });
      setSelectedFundsByProductId(new Map());
    }
  }, [open]);

  const runSearch = useCallback(
    async (query: string, page: number, pageSize: number) => {
      setPicker((current) => ({ ...current, loading: true }));
      try {
        const payload = await fetchMfFunds({
          q: query.trim() || undefined,
          page: page + 1,
          page_size: pageSize,
          purchasable: true,
          lifecycle_status: "ACTIVE",
        });
        setPicker((current) => ({
          ...current,
          loading: false,
          page,
          pageSize,
          total: payload.total,
          hasMore: payload.has_more,
          results: payload.items.filter(
            (item) => item.product_id && !excludedProductIds.has(item.product_id),
          ),
        }));
      } catch {
        setPicker((current) => ({
          ...current,
          loading: false,
          results: [],
          total: 0,
          hasMore: false,
        }));
      }
    },
    [excludedProductIds],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void runSearch(picker.query, picker.page, picker.pageSize);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, picker.query, picker.page, picker.pageSize, runSearch]);

  const toggleFundSelection = (fund: MfFundAdmin) => {
    const productId = fund.product_id;
    if (!productId) return;

    setSelectedFundsByProductId((current) => {
      const next = new Map(current);
      if (next.has(productId)) {
        next.delete(productId);
        return next;
      }
      if (next.size >= remainingSlots) return current;
      next.set(productId, fund);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedFunds.length === 0) return;
    onSelect(selectedFunds);
    onClose();
  };

  const confirmLabel =
    selectedFunds.length === 0
      ? "Add funds"
      : selectedFunds.length === 1
        ? "Add 1 fund"
        : `Add ${selectedFunds.length} funds`;

  const totalPages = picker.total > 0 ? Math.ceil(picker.total / picker.pageSize) : undefined;

  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Add funds to basket"
      description={`Search the investable MF catalog and add funds to this basket pool. Select multiple funds at once — up to ${MAX_POOL_FUNDS} per basket (${INVESTOR_FUNDS_PER_BASKET} shown to investors).`}
      icon={Sparkles}
      iconTone="info"
      size="xl"
      bodyClassName="max-h-dialog-body-detail"
      footer={
        <AdminDialogFooterActions
          cancelLabel="Cancel"
          confirmLabel={confirmLabel}
          confirmDisabled={selectedFunds.length === 0}
          onCancel={onClose}
          onConfirm={handleConfirm}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AdminSearchInput
            placeholder="Search by scheme or AMC"
            value={picker.query}
            onChange={(event) =>
              setPicker((current) => ({
                ...current,
                query: event.target.value,
                page: 0,
              }))
            }
            className="min-w-[16rem] flex-1"
          />
          <p className="text-caption text-muted-foreground">
            {selectedCount} selected · {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
          </p>
        </div>
        <AdminDataTable
          footer={
            <AdminTablePagination
              page={picker.page}
              totalPages={totalPages}
              hasPrevious={picker.page > 0}
              hasNext={picker.hasMore}
              disabled={picker.loading}
              totalCount={picker.total}
              currentPageCount={picker.results.length}
              hasMore={picker.hasMore}
              pageSize={picker.pageSize}
              onPageSizeChange={(nextPageSize) => {
                setPicker((current) => ({
                  ...current,
                  pageSize: nextPageSize,
                  page: 0,
                }));
              }}
              onPrevious={() =>
                setPicker((current) => ({
                  ...current,
                  page: Math.max(0, current.page - 1),
                }))
              }
              onNext={() =>
                setPicker((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
            />
          }
        >
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHeadCell className="w-12">
                <span className="sr-only">Select</span>
              </AdminTableHeadCell>
              <AdminTableHeadCell>Scheme</AdminTableHeadCell>
              <AdminTableHeadCell>AMC</AdminTableHeadCell>
            </AdminTableRow>
          </AdminTableHeader>
          <AdminTableBody>
            {picker.loading ? <AdminTableSkeletonRows columns={3} rows={picker.pageSize} /> : null}
            {!picker.loading && picker.results.length === 0 ? (
              <AdminTableStateRow colSpan={3}>No investable funds found.</AdminTableStateRow>
            ) : null}
            {!picker.loading
              ? picker.results.map((fund) => {
                  const productId = fund.product_id;
                  const isSelected = Boolean(productId && selectedFundsByProductId.has(productId));
                  const selectionDisabled =
                    !productId || (!isSelected && selectedCount >= remainingSlots);

                  return (
                    <AdminTableRow
                      key={fund.fund_id}
                      className={cn(
                        productId && !selectionDisabled ? "cursor-pointer" : "cursor-default",
                        isSelected && "bg-primary/5",
                        selectionDisabled && !isSelected && "opacity-60",
                      )}
                      onClick={() => {
                        if (!productId || selectionDisabled) return;
                        toggleFundSelection(fund);
                      }}
                    >
                      <AdminTableCell className="w-12">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`Select ${fund.scheme_name}`}
                          disabled={selectionDisabled}
                          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!productId || selectionDisabled) return;
                            toggleFundSelection(fund);
                          }}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="size-5 text-primary" aria-hidden />
                          ) : (
                            <Circle className="size-5" aria-hidden />
                          )}
                        </button>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <AmcLogo
                            name={fund.amc_name}
                            logoUrl={fund.amc_logo_url}
                            size="sm"
                            fallback="icon"
                          />
                          <p className="min-w-0 font-medium">{fund.scheme_name}</p>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>{fund.amc_name}</AdminTableCell>
                    </AdminTableRow>
                  );
                })
              : null}
          </AdminTableBody>
        </AdminDataTable>
      </div>
    </AdminFormDialog>
  );
}

type PreviewUserSelection = {
  userId: string;
  clientId: string;
  email: string;
  displayName: string;
};

function mapPreviewUserSearchItem(item: Record<string, unknown>): PreviewUserSelection | null {
  const userId = String(item.user_id ?? "");
  if (!userId) return null;
  return {
    userId,
    clientId: String(item.client_id ?? ""),
    email: String(item.email ?? ""),
    displayName: String(item.display_name ?? item.email ?? userId),
  };
}

const PREVIEW_ALLOCATION_COLORS: Record<string, string> = {
  equity: "#38bdf8",
  debt: "#34d399",
  hybrid: "#fbbf24",
  gold: "#fb7185",
};

function previewAllocationColor(sliceId: string) {
  return PREVIEW_ALLOCATION_COLORS[sliceId] ?? "#c4b5fd";
}

function formatPreviewSchemeName(name: string) {
  if (!name || name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function resolvePreviewTierLabel(tier: string | null | undefined) {
  if (!tier) return null;
  return RECOMMENDATION_RISK_TIERS.find((item) => item.id === tier)?.label ?? tier;
}

function RecommendationPreviewAllocationBar({
  allocation,
}: {
  allocation: RecommendationPreviewAllocationSlice[];
}) {
  if (allocation.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/50">
        {allocation.map((slice) => (
          <div
            key={slice.id}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${slice.value_pct}%`,
              backgroundColor: previewAllocationColor(slice.id),
            }}
            title={`${slice.label} ${slice.value_pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {allocation.map((slice) => (
          <div key={slice.id} className="inline-flex items-center gap-2 text-compact">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: previewAllocationColor(slice.id) }}
              aria-hidden
            />
            <span className="font-medium text-foreground">{slice.label}</span>
            <span className="text-muted-foreground">{slice.value_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationPreviewFundRow({
  fund,
  rank,
}: {
  fund: RecommendationPreviewFund;
  rank: number;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-background px-3 py-3 shadow-xs">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-caption font-semibold text-muted-foreground">
        {rank}
      </span>
      <AmcLogo name={fund.amc_name} logoUrl={fund.amc_logo_url} size="sm" fallback="icon" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-compact font-medium leading-snug text-foreground">
          {formatPreviewSchemeName(fund.scheme_name)}
        </p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{fund.amc_name}</p>
      </div>
      {fund.min_lumpsum_amount_inr != null ? (
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-caption text-muted-foreground">Min. lumpsum</p>
          <p className="text-compact font-medium tabular-nums">
            ₹{fund.min_lumpsum_amount_inr.toLocaleString("en-IN")}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function RecommendationPreviewResult({
  preview,
  selectedUser,
  onClearUser,
  isRefreshing,
}: {
  preview: RecommendationPreview;
  selectedUser: PreviewUserSelection;
  onClearUser: () => void;
  isRefreshing: boolean;
}) {
  const tierLabel = resolvePreviewTierLabel(preview.tier);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <AdminUserProfileAvatar name={selectedUser.displayName} email={selectedUser.email} size="lg" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-foreground">{selectedUser.displayName}</p>
              {tierLabel && preview.tier ? (
                <RiskProfileTierBadge tier={preview.tier} label={tierLabel} />
              ) : null}
            </div>
            <p className="truncate text-compact text-muted-foreground">{selectedUser.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selected user"
          onClick={onClearUser}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-muted/15 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
            <Layers3 className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Matched basket</p>
            <p className="truncate text-base font-semibold text-foreground">{preview.basket_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Refreshing…
            </span>
          ) : null}
          <StatusBadge variant="neutral" showIcon={false}>
            Config v{preview.config_version}
          </StatusBadge>
          <StatusBadge variant="success" showIcon={false}>
            {preview.funds.length} funds
          </StatusBadge>
        </div>
      </div>

      {preview.allocation.length > 0 ? (
        <div className="space-y-3">
          <AdminSectionTitle variant="section">Asset allocation</AdminSectionTitle>
          <RecommendationPreviewAllocationBar allocation={preview.allocation} />
        </div>
      ) : null}

      <div className="space-y-3">
        <AdminSectionTitle variant="section">Recommended funds</AdminSectionTitle>
        <ul className="space-y-2">
          {preview.funds.map((fund, index) => (
            <RecommendationPreviewFundRow key={fund.product_id} fund={fund} rank={index + 1} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function RecommendationPreviewPanel({ tier }: { tier: RiskTierId }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<PreviewUserSelection | null>(null);
  const [searchResults, setSearchResults] = useState<PreviewUserSelection[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRequestRef = useRef(0);

  const previewQuery = useRecommendationPreviewQuery({
    tier,
    sampleUserId: selectedUser?.userId ?? "",
    enabled: Boolean(selectedUser?.userId),
  });

  useEffect(() => {
    setSelectedUser(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  }, [tier]);

  useEffect(() => {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchAdmin({ scope: "users", q: normalized, limit: 10 })
        .then((result) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults(
            result.items
              .map((item) => mapPreviewUserSearchItem(item as Record<string, unknown>))
              .filter((item): item is PreviewUserSelection => item !== null),
          );
        })
        .catch(() => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) {
            setSearchLoading(false);
          }
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const showSearchDropdown = searchOpen && searchQuery.trim().length >= 2;

  const handleSelectUser = (user: PreviewUserSelection) => {
    setSelectedUser(user);
    setSearchQuery(user.displayName);
    setSearchOpen(false);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <AdminSearchInput
          placeholder="Search by name or email"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchOpen(true);
            if (selectedUser && event.target.value !== selectedUser.displayName) {
              setSelectedUser(null);
            }
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
        />
        {showSearchDropdown ? (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-control)] border border-border bg-popover shadow-zynd-mid">
            {searchLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 text-compact text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Searching…
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-2.5 text-compact text-muted-foreground">No users found.</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {searchResults.map((user) => (
                  <li key={user.userId}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-muted/50"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectUser(user)}
                    >
                      <span className="text-compact font-medium text-foreground">{user.displayName}</span>
                      <span className="text-caption text-muted-foreground">{user.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-xs">
        {!selectedUser ? (
          <div className="px-4 py-5">
            <AdminPanelEmptyState icon={UserSearch} label="Search for a user to preview recommendations" />
          </div>
        ) : (
          <div className="px-5 py-5">
            {previewQuery.isFetching && !previewQuery.data ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 border-b border-border pb-5">
                  <AdminUserProfileAvatar name={selectedUser.displayName} email={selectedUser.email} size="lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-base font-semibold text-foreground">{selectedUser.displayName}</p>
                    <p className="truncate text-compact text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <AdminCardListSkeleton count={3} lines={2} />
              </div>
            ) : null}
            {previewQuery.error ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <AdminUserProfileAvatar name={selectedUser.displayName} email={selectedUser.email} size="lg" />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-foreground">{selectedUser.displayName}</p>
                      <p className="truncate text-compact text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear selected user"
                    onClick={handleClearUser}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <AdminFeedbackMessage variant="destructive">
                  {getErrorMessage(previewQuery.error, "Could not run preview.")}
                </AdminFeedbackMessage>
              </div>
            ) : null}
            {previewQuery.data && !previewQuery.data.eligible ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <AdminUserProfileAvatar name={selectedUser.displayName} email={selectedUser.email} size="lg" />
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-foreground">{selectedUser.displayName}</p>
                      <p className="truncate text-compact text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear selected user"
                    onClick={handleClearUser}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <AdminFeedbackMessage variant="warning">
                  Preview blocked: {previewQuery.data.block_reason ?? "unknown"}
                </AdminFeedbackMessage>
              </div>
            ) : null}
            {previewQuery.data?.eligible ? (
              <RecommendationPreviewResult
                preview={previewQuery.data}
                selectedUser={selectedUser}
                onClearUser={handleClearUser}
                isRefreshing={previewQuery.isFetching}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function BasketDetailsView({
  displayName,
  description,
  objectiveSummary,
  tier,
  slug,
}: {
  displayName: string;
  description: string;
  objectiveSummary: string;
  tier: RiskTierId;
  slug: string;
}) {
  const tierVisual = resolveRiskTierVisual(tier);
  const tierLabel = RECOMMENDATION_RISK_TIERS.find((entry) => entry.id === tier)?.label ?? tier;
  const trimmedDescription = description.trim();
  const trimmedObjective = objectiveSummary.trim();

  return (
    <div className="space-y-4 md:col-span-2">
      <div
        className="rounded-[var(--radius-card)] border px-5 py-4"
        style={{
          borderColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 28%, var(--border))`,
          backgroundColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 7%, var(--card))`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
              Investor display name
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
              {displayName.trim() || "Untitled basket"}
            </p>
            <p className="mt-1 font-mono text-caption text-muted-foreground">{slug}</p>
          </div>
          <StatusBadge variant={resolveRiskTierBadgeVariant(tier)} showIcon={false}>
            {tierLabel}
          </StatusBadge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-control)] border border-border bg-muted/5 px-4 py-3.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlignLeft className="size-3.5 shrink-0" aria-hidden />
            <p className="text-caption font-medium">Description</p>
          </div>
          <p
            className={cn(
              "mt-2.5 text-compact leading-relaxed",
              trimmedDescription ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {trimmedDescription || "No description yet."}
          </p>
        </div>
        <div className="rounded-[var(--radius-control)] border border-border bg-muted/5 px-4 py-3.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="size-3.5 shrink-0" aria-hidden />
            <p className="text-caption font-medium">Objective</p>
          </div>
          <p
            className={cn(
              "mt-2.5 text-compact leading-relaxed",
              trimmedObjective ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {trimmedObjective || "No objective yet."}
          </p>
        </div>
      </div>
    </div>
  );
}

function BasketEditor({
  basketId,
  tier,
  canManage,
  onDeleted,
}: {
  basketId: string;
  tier: RiskTierId;
  canManage: boolean;
  onDeleted: () => void;
}) {
  const detailQuery = useRecommendationBasketDetailQuery(basketId);
  const { updateBasket, removeBasket, replaceFunds } = useRecommendationMutations(tier);
  const [draftFunds, setDraftFunds] = useState<RecommendationBasketFund[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [objectiveSummary, setObjectiveSummary] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fundPickerOpen, setFundPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const basket = detailQuery.data;

  useEffect(() => {
    setIsEditingDetails(false);
  }, [basketId]);

  const syncDetailsFromBasket = useCallback((source: RecommendationBasket) => {
    setDisplayName(recommendationBasketDisplayName(source));
    setDescription(source.description ?? "");
    setObjectiveSummary(source.objective_summary ?? "");
  }, []);

  useEffect(() => {
    if (!basket) return;
    syncDetailsFromBasket(basket);
    setDraftFunds(basket.funds);
  }, [basket, syncDetailsFromBasket]);

  const excludedProductIds = useMemo(
    () => new Set(draftFunds.map((fund) => fund.product_id)),
    [draftFunds],
  );

  const persistFunds = async (nextFunds: RecommendationBasketFund[]) => {
    if (!canManage) return;
    setError("");
    try {
      const payload = await replaceFunds.mutateAsync({
        basketId,
        funds: nextFunds.map((fund, index) => ({
          product_id: fund.product_id,
          sort_order: index,
          allocation_weight_pct: fund.allocation_weight_pct,
          portfolio_role: fund.portfolio_role,
          is_anchor: fund.is_anchor,
          is_alternative: fund.is_alternative,
          alternative_for_product_id: fund.alternative_for_product_id,
          is_active: fund.is_active,
        })),
      });
      setDraftFunds(payload.funds);
      setMessage("Fund pool saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save fund pool."));
    }
  };

  const moveFund = (index: number, direction: -1 | 1) => {
    const next = [...draftFunds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftFunds(next);
    void persistFunds(next);
  };

  const toggleAnchor = (index: number) => {
    const next = draftFunds.map((fund, idx) =>
      idx === index ? { ...fund, is_anchor: !fund.is_anchor } : fund,
    );
    setDraftFunds(next);
    void persistFunds(next);
  };

  const removeFund = (index: number) => {
    const next = draftFunds.filter((_, idx) => idx !== index);
    setDraftFunds(next);
    void persistFunds(next);
  };

  const handleAddFunds = (funds: MfFundAdmin[]) => {
    const validFunds = funds.filter((fund) => fund.product_id);
    if (validFunds.length === 0) return;

    const next = [...draftFunds];
    for (const fund of validFunds) {
      if (next.length >= MAX_POOL_FUNDS) break;
      if (next.some((entry) => entry.product_id === fund.product_id)) continue;
      next.push(draftBasketFundFromCatalog(fund, next.length));
    }

    setDraftFunds(next);
    void persistFunds(next);
  };

  const handleSaveMetadata = async () => {
    if (!canManage || !basket) return;
    setError("");
    try {
      await updateBasket.mutateAsync({
        basketId,
        payload: {
          portfolio_display_name: displayName.trim() || undefined,
          description: description || undefined,
          objective_summary: objectiveSummary || undefined,
        },
      });
      setMessage("Basket details saved.");
      setIsEditingDetails(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save basket."));
    }
  };

  const handleCancelEditDetails = () => {
    if (basket) syncDetailsFromBasket(basket);
    setIsEditingDetails(false);
  };

  const handleToggleBasketActive = async (nextActive: boolean) => {
    if (!canManage || !basket) return;
    setError("");
    try {
      await updateBasket.mutateAsync({
        basketId,
        payload: { is_active: nextActive },
      });
      setMessage(nextActive ? "Basket enabled." : "Basket disabled.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not update basket status."));
    }
  };

  const handleDelete = async () => {
    if (!canManage) return;
    try {
      await removeBasket.mutateAsync(basketId);
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete basket."));
    } finally {
      setConfirmDelete(false);
    }
  };

  if (detailQuery.isPending && !basket) {
    return (
      <div className="space-y-4">
        <AdminFormSkeleton rows={4} />
        <AdminTableSkeleton columns={5} rows={4} />
      </div>
    );
  }

  if (!basket) {
    return (
      <AdminFeedbackMessage variant="destructive">
        {getErrorMessage(detailQuery.error, "Could not load basket.")}
      </AdminFeedbackMessage>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {basketNeedsMoreFunds(basket) ? (
        <AdminFeedbackMessage variant="warning">
          Pool must have at least {MIN_POOL_FUNDS} funds before investors can receive recommendations from this basket.
        </AdminFeedbackMessage>
      ) : null}
      {draftFunds.length >= MAX_POOL_FUNDS ? (
        <AdminFeedbackMessage variant="info">
          This basket pool is full ({MAX_POOL_FUNDS} funds). Investors still receive {INVESTOR_FUNDS_PER_BASKET} funds per recommendation.
        </AdminFeedbackMessage>
      ) : null}

      <AdminPanelCard
        title={isEditingDetails ? "Edit basket details" : recommendationBasketDisplayName(basket)}
        description={isEditingDetails ? "Update how this basket appears to investors." : "Basket details"}
        icon={Layers3}
        actions={
          <>
            {canManage ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                {isEditingDetails ? (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={handleCancelEditDetails}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveMetadata()}
                      disabled={updateBasket.isPending || !displayName.trim()}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Edit basket details"
                    onClick={() => setIsEditingDetails(true)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <StatusBadge variant={basket.is_active ? "success" : "neutral"} showIcon={false}>
                {basket.is_active ? "Active" : "Disabled"}
              </StatusBadge>
              {canManage ? (
                <Switch
                  checked={basket.is_active}
                  disabled={updateBasket.isPending}
                  onCheckedChange={(checked) => void handleToggleBasketActive(checked)}
                  aria-label={basket.is_active ? "Disable basket" : "Enable basket"}
                />
              ) : null}
            </div>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {isEditingDetails ? (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="basket-display-name">Display name</Label>
                <Input
                  id="basket-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Balanced Core Portfolio"
                  autoFocus
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="basket-description">Description</Label>
                <textarea
                  id="basket-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="basket-objective">Objective</Label>
                <textarea
                  id="basket-objective"
                  value={objectiveSummary}
                  onChange={(event) => setObjectiveSummary(event.target.value)}
                  rows={2}
                  className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </>
          ) : (
            <BasketDetailsView
              displayName={displayName}
              description={description}
              objectiveSummary={objectiveSummary}
              tier={basket.tier}
              slug={basket.slug}
            />
          )}
        </div>

        <div className="mt-6 space-y-3 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AdminSectionTitle variant="section">Fund pool</AdminSectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="neutral" showIcon={false}>
                {draftFunds.length}/{MAX_POOL_FUNDS} funds
              </StatusBadge>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={draftFunds.length >= MAX_POOL_FUNDS}
                  onClick={() => setFundPickerOpen(true)}
                >
                  <Plus className="size-4" />
                  Add funds
                </Button>
              ) : null}
            </div>
          </div>

          <AdminDataTable
            scrollClassName="overflow-y-auto"
            scrollStyle={{ maxHeight: FUND_POOL_TABLE_MAX_HEIGHT }}
          >
            <AdminTableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <AdminTableRow>
                <AdminTableHeadCell className="w-28">
                  <span className="sr-only">Actions</span>
                </AdminTableHeadCell>
                <AdminTableHeadCell className="w-16">Order</AdminTableHeadCell>
                <AdminTableHeadCell className="min-w-[12rem]">Fund</AdminTableHeadCell>
                <AdminTableHeadCell className="min-w-[8rem]">AMC</AdminTableHeadCell>
                <AdminTableHeadCell className="w-24">Anchor</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {draftFunds.length === 0 ? (
                <AdminTableStateRow colSpan={5}>No funds in this basket yet.</AdminTableStateRow>
              ) : (
                draftFunds.map((fund, index) => (
                  <AdminTableRow key={fund.product_id} className="min-h-[4.75rem]">
                    <AdminTableCell className="align-top">
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canManage || index === 0} onClick={() => moveFund(index, -1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={!canManage || index === draftFunds.length - 1}
                          onClick={() => moveFund(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canManage} onClick={() => removeFund(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell className="align-top">{index + 1}</AdminTableCell>
                    <AdminTableCell className="max-w-xs align-top sm:max-w-sm">
                      <div className="flex min-w-0 items-start gap-3">
                        <AmcLogo
                          name={fund.amc_name}
                          logoUrl={fund.amc_logo_url}
                          size="sm"
                          fallback="icon"
                        />
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words font-medium leading-snug">
                            {fund.scheme_name ?? fund.product_id}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{fund.lifecycle_status ?? "unknown"}</p>
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell className="max-w-[10rem] align-top">
                      <p className="line-clamp-2 break-words leading-snug">{fund.amc_name ?? "—"}</p>
                    </AdminTableCell>
                    <AdminTableCell className="align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant={fund.is_anchor ? "default" : "outline"}
                        disabled={!canManage}
                        onClick={() => toggleAnchor(index)}
                      >
                        {fund.is_anchor ? "Core" : "Optional"}
                      </Button>
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </div>
      </AdminPanelCard>

      <FundPickerDialog
        open={fundPickerOpen}
        onClose={() => setFundPickerOpen(false)}
        onSelect={handleAddFunds}
        excludedProductIds={excludedProductIds}
        currentPoolCount={draftFunds.length}
      />

      <AdminConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Delete basket?"
        description="This basket will be hidden from recommendation selection."
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </div>
  );
}

function PublishReadinessCard({
  readiness,
  isLoading,
}: {
  readiness: RecommendationPublishReadiness | undefined;
  isLoading: boolean;
}) {
  if (isLoading && !readiness) {
    return (
      <AdminPanelCard
        title="Publish readiness"
        description="Checking basket fund pools and tier coverage."
        icon={CheckCircle2}
      >
        <AdminFormSkeleton rows={3} />
      </AdminPanelCard>
    );
  }

  if (!readiness) return null;

  return (
    <AdminPanelCard
      title="Publish readiness"
      description={`Every active basket needs at least ${readiness.required_fund_count} investable funds before publish.`}
      icon={CheckCircle2}
    >
      <div className="space-y-3">
        {readiness.can_publish ? (
          <AdminFeedbackMessage variant="success">
            Configuration is ready to publish.
          </AdminFeedbackMessage>
        ) : (
          <AdminFeedbackMessage variant="warning">
            Resolve the issues below before publishing.
          </AdminFeedbackMessage>
        )}

        {readiness.issues.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {readiness.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.basket_id ?? index}`} className="rounded-md border px-3 py-2">
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AdminPanelCard>
  );
}

function RecommendationOpsMetricsGrid({
  metrics,
  isLoading,
}: {
  metrics: ReturnType<typeof useRecommendationMetricsQuery>["data"];
  isLoading: boolean;
}) {
  const eligibleTotal = metrics?.resolve_total.eligible ?? 0;
  const blockedTotal = metrics?.resolve_total.blocked ?? 0;
  const hitRate =
    metrics?.snapshot_hit_rate != null
      ? `${Math.round(metrics.snapshot_hit_rate * 100)}%`
      : "No data";
  const avgCompute =
    metrics?.compute_duration_ms_avg != null ? metrics.compute_duration_ms_avg : "No data";

  return (
    <AdminMetricCardsGrid columns="four">
      <AdminMetricCard
        label="Eligible resolves"
        value={eligibleTotal}
        icon={CheckCircle2}
        tone="success"
        loading={isLoading && !metrics}
        infoDescription="In-process eligible recommendation resolves since the API process started."
      />
      <AdminMetricCard
        label="Blocked resolves"
        value={blockedTotal}
        icon={Ban}
        tone="warning"
        loading={isLoading && !metrics}
        infoDescription="In-process blocked recommendation resolves since the API process started."
      />
      <AdminMetricCard
        label="Snapshot hit rate"
        value={hitRate}
        icon={Gauge}
        tone="info"
        loading={isLoading && !metrics}
        infoDescription="Share of resolves served from cached snapshots."
      />
      <AdminMetricCard
        label="Avg compute (ms)"
        value={avgCompute}
        icon={Activity}
        tone="muted"
        loading={isLoading && !metrics}
        infoDescription="Average compute duration for recommendation resolution."
      />
    </AdminMetricCardsGrid>
  );
}

export function RecommendationOpsMetricsSection({
  canPublish,
}: {
  canPublish: boolean;
}) {
  const metricsQuery = useRecommendationMetricsQuery(canPublish);

  if (!canPublish) return null;

  return (
    <RecommendationOpsMetricsGrid metrics={metricsQuery.data} isLoading={metricsQuery.isPending} />
  );
}

function RecommendationStatusMessages({
  recommendationApiUnavailable,
  recommendationPermissionDenied,
  tierHasShortPool,
  tierBasketLimitReached,
  activeTier,
}: {
  recommendationApiUnavailable: boolean;
  recommendationPermissionDenied: boolean;
  tierHasShortPool: boolean;
  tierBasketLimitReached: boolean;
  activeTier: RiskTierId;
}) {
  return (
    <>
      {recommendationApiUnavailable ? (
        <AdminFeedbackMessage variant="warning">
          Recommendation API routes are not available on the backend (404). Restart the Python API
          server so it loads the Funds For You admin routes, then refresh this page.
        </AdminFeedbackMessage>
      ) : null}
      {recommendationPermissionDenied ? (
        <AdminFeedbackMessage variant="warning">
          Your session is missing Funds For You permissions. Sign out and sign back in to refresh
          access.
        </AdminFeedbackMessage>
      ) : null}
      {tierHasShortPool ? (
        <AdminFeedbackMessage variant="warning">
          One or more active baskets in {activeTier} have fewer than {MIN_POOL_FUNDS} funds.
        </AdminFeedbackMessage>
      ) : null}
      {tierBasketLimitReached ? (
        <AdminFeedbackMessage variant="info">
          {activeTier} tier already has {MAX_BASKETS_PER_TIER} baskets. Delete one to add another.
        </AdminFeedbackMessage>
      ) : null}
    </>
  );
}

export function RecommendationBasketsTabPanel({ canManage }: { canManage: boolean }) {
  const [activeTier, setActiveTier] = useState<RiskTierId>("moderate");
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBasketDisplayName, setNewBasketDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const configQuery = useRecommendationConfigQuery();
  const readinessQuery = useRecommendationPublishReadinessQuery();
  const basketsQuery = useRecommendationBasketsQuery(activeTier);
  const { createBasket } = useRecommendationMutations(activeTier);

  const baskets = basketsQuery.data ?? [];
  const tierBaskets = useMemo(() => sortTierBaskets(baskets), [baskets]);
  const activeBaskets = baskets.filter((basket) => basket.is_active);

  useEffect(() => {
    if (!selectedBasketId && tierBaskets.length > 0) {
      setSelectedBasketId(tierBaskets[0].id);
    }
    if (selectedBasketId && !tierBaskets.some((basket) => basket.id === selectedBasketId)) {
      setSelectedBasketId(tierBaskets[0]?.id ?? null);
    }
  }, [tierBaskets, selectedBasketId]);

  useEffect(() => {
    setSelectedBasketId(null);
  }, [activeTier]);

  const tierHasShortPool = activeBaskets.some((basket) => basketNeedsMoreFunds(basket));
  const tierBasketLimitReached = baskets.length >= MAX_BASKETS_PER_TIER;
  const recommendationApiUnavailable = [configQuery, readinessQuery, basketsQuery].some(
    (query) =>
      query.isError &&
      query.error instanceof ApiError &&
      (query.error.status === 404 || query.error.message === "Not Found"),
  );
  const recommendationPermissionDenied = [configQuery, readinessQuery, basketsQuery].some(
    (query) => query.isError && query.error instanceof ApiError && query.error.status === 403,
  );

  const handleCreateBasket = async () => {
    if (!canManage || !newBasketDisplayName.trim() || tierBasketLimitReached) return;
    setError("");
    try {
      const created = await createBasket.mutateAsync({
        tier: activeTier,
        portfolio_display_name: newBasketDisplayName.trim(),
      });
      setSelectedBasketId(created.id);
      setNewBasketDisplayName("");
      setCreateOpen(false);
      setMessage("Basket created.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not create basket."));
    }
  };

  const showBasketsSkeleton = basketsQuery.isPending && !basketsQuery.data;
  const activeTierLabel =
    RECOMMENDATION_RISK_TIERS.find((tier) => tier.id === activeTier)?.label ?? activeTier;
  const activeTierVisual = resolveRiskTierVisual(activeTier);

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setNewBasketDisplayName("");
  };

  return (
    <div className="box-border w-full max-w-full min-w-0 space-y-4">
      <RecommendationTierSelector
        value={activeTier}
        onValueChange={setActiveTier}
        trailing={
          <StatusBadge variant="neutral">
            Published v{configQuery.data?.published_version ?? 0}
          </StatusBadge>
        }
      />

      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      <RecommendationStatusMessages
        recommendationApiUnavailable={recommendationApiUnavailable}
        recommendationPermissionDenied={recommendationPermissionDenied}
        tierHasShortPool={tierHasShortPool}
        tierBasketLimitReached={tierBasketLimitReached}
        activeTier={activeTier}
      />

      {showBasketsSkeleton ? (
        <AdminRecommendationsPageSkeleton tab="baskets" />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <AdminPanelCard
            title="Baskets"
            icon={Layers3}
            actions={
              canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={tierBasketLimitReached}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              ) : null
            }
          >
            <div className="space-y-2">
              {tierBaskets.length === 0 ? (
                <AdminPanelEmptyState icon={Layers3} label="No baskets yet" />
              ) : (
                tierBaskets.map((basket) => (
                  <button
                    key={basket.id}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      selectedBasketId === basket.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                      !basket.is_active && "opacity-70",
                    )}
                    onClick={() => setSelectedBasketId(basket.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium">{recommendationBasketDisplayName(basket)}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge variant={basket.is_active ? "success" : "neutral"} showIcon={false}>
                          {basket.is_active ? "Active" : "Disabled"}
                        </StatusBadge>
                        <StatusBadge variant="neutral" showIcon={false}>
                          {basket.investable_fund_count}/{basket.fund_count}
                        </StatusBadge>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </AdminPanelCard>

          <div className="min-w-0 space-y-4">
            {selectedBasketId ? (
              <BasketEditor
                basketId={selectedBasketId}
                tier={activeTier}
                canManage={canManage}
                onDeleted={() => setSelectedBasketId(null)}
              />
            ) : (
              <AdminPanelCard title="Basket editor" icon={Layers3}>
                <AdminPanelEmptyState icon={Layers3} label="No basket selected" />
              </AdminPanelCard>
            )}
          </div>
        </div>
      )}

      <AdminFormDialog
        open={createOpen}
        onClose={closeCreateDialog}
        title="Create basket"
        description="Add a display name for investors. Internal identifiers are assigned automatically."
        icon={Layers3}
        iconTone="info"
        footer={
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Create basket"
            loading={createBasket.isPending}
            loadingLabel="Creating…"
            confirmDisabled={!newBasketDisplayName.trim()}
            onCancel={closeCreateDialog}
            onConfirm={() => void handleCreateBasket()}
          />
        }
      >
        <div className="space-y-5">
          {error && createOpen ? (
            <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>
          ) : null}

          <div
            className="rounded-control border border-border bg-muted/10 px-4 py-3"
            style={{
              borderColor: `color-mix(in srgb, ${activeTierVisual.gaugeColor} 28%, var(--border))`,
              backgroundColor: `color-mix(in srgb, ${activeTierVisual.gaugeColor} 8%, var(--card))`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: activeTierVisual.gaugeColor }}
                aria-hidden
              />
              <p className="text-compact font-medium text-foreground">{activeTierLabel} tier</p>
            </div>
            <p className="mt-1.5 text-caption text-muted-foreground">
              Each tier supports up to {MAX_BASKETS_PER_TIER} baskets ({MAX_BASKETS_PER_TIER} ×{" "}
              {INVESTOR_FUNDS_PER_BASKET} = {MAX_BASKETS_PER_TIER * INVESTOR_FUNDS_PER_BASKET} investor
              fund slots). This basket will be eligible for {activeTierLabel.toLowerCase()} investors after
              you publish configuration.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-basket-display-name">Display name</Label>
            <Input
              id="new-basket-display-name"
              value={newBasketDisplayName}
              onChange={(event) => setNewBasketDisplayName(event.target.value)}
              placeholder="Balanced Core"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && newBasketDisplayName.trim() && !createBasket.isPending) {
                  event.preventDefault();
                  void handleCreateBasket();
                }
              }}
            />
          </div>
        </div>
      </AdminFormDialog>
    </div>
  );
}

export function RecommendationPublishTabPanel({ canPublish }: { canPublish: boolean }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [activeTier] = useState<RiskTierId>("moderate");

  const configQuery = useRecommendationConfigQuery();
  const readinessQuery = useRecommendationPublishReadinessQuery();
  const { publishConfig } = useRecommendationMutations(activeTier);

  const publishReadiness = readinessQuery.data;
  const publishBlocked = publishReadiness ? !publishReadiness.can_publish : true;
  const showPublishSkeleton = readinessQuery.isPending && !readinessQuery.data;

  const handlePublish = async () => {
    if (!canPublish) return;
    setError("");
    try {
      const config = await publishConfig.mutateAsync();
      setPublishConfirmOpen(false);
      setMessage(`Published recommendation config v${config.published_version}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not publish configuration."));
    }
  };

  return (
    <div className="box-border w-full max-w-full min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AdminSectionTitle variant="tab">Publish & operations</AdminSectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="neutral">
            Published v{configQuery.data?.published_version ?? 0}
          </StatusBadge>
          {canPublish ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setPublishConfirmOpen(true)}
              disabled={publishConfig.isPending || publishBlocked}
            >
              <Upload className="size-4" />
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      {showPublishSkeleton ? (
        <AdminRecommendationsPageSkeleton tab="publish" />
      ) : (
        <PublishReadinessCard readiness={publishReadiness} isLoading={readinessQuery.isPending} />
      )}

      <AdminConfirmDialog
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        onConfirm={() => void handlePublish()}
        title="Publish recommendation configuration?"
        description={
          publishReadiness?.can_publish
            ? `This will bump the published version from v${configQuery.data?.published_version ?? 0} and invalidate investor snapshots on next open.`
            : "Publishing is blocked until all readiness checks pass."
        }
        confirmLabel="Publish now"
        confirmDisabled={publishBlocked || publishConfig.isPending}
      />
    </div>
  );
}

export function RecommendationPreviewTabPanel() {
  const [activeTier, setActiveTier] = useState<RiskTierId>("moderate");

  return (
    <div className="box-border w-full max-w-full min-w-0 space-y-4">
      <RecommendationTierSelector value={activeTier} onValueChange={setActiveTier} />

      <RecommendationPreviewPanel tier={activeTier} />
    </div>
  );
}
