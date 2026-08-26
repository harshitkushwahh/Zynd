"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  Coins,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { referralReferrerDetailHref } from "@/lib/admin-referrals-navigation";
import {
  fetchAdminReferralMetrics,
  formatReferralInr,
  type AdminReferralMetrics,
  type AdminReferralReferrerDirectoryEntry,
} from "@/lib/referrals-admin-api";
import { useAdminSearch } from "@/hooks/use-admin-search";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function ReferralsReferrersPanel() {
  const [metrics, setMetrics] = useState<AdminReferralMetrics | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");

  const {
    items,
    loading,
    error,
    refetch,
    setError,
  } = useAdminSearch<AdminReferralReferrerDirectoryEntry>({
    scope: "referrals.referrers",
    query: search,
    limit: ADMIN_TABLE_PAGE_SIZE,
    offset,
  });
  const hasMore = items.length === ADMIN_TABLE_PAGE_SIZE;

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");
    try {
      setMetrics(await fetchAdminReferralMetrics());
    } catch (err) {
      setMetrics(null);
      setMetricsError(getErrorMessage(err, "Could not load referral metrics."));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const displayError = error || metricsError;

  return (
    <div className="space-y-6">
      {displayError ? (
        <AdminFeedbackMessage
          variant="destructive"
          onDismiss={() => {
            setError("");
            setMetricsError("");
          }}
        >
          {displayError}
        </AdminFeedbackMessage>
      ) : null}

      <AdminMetricCardsGrid columns="four" className="mt-0 mb-0 min-w-0 max-w-full">
        <AdminMetricCard
          variant="flip"
          label="Link clicks"
          value={metrics?.total_clicks ?? 0}
          icon={MousePointerClick}
          loading={metricsLoading}
          back={{
            label: "KYC completed",
            value: metrics?.kyc_verified_count ?? 0,
            icon: ClipboardCheck,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Referral signups"
          value={metrics?.total_attributions ?? 0}
          icon={UserPlus}
          loading={metricsLoading}
          back={{
            label: "First investment",
            value: metrics?.first_investment_count ?? 0,
            icon: TrendingUp,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Active referrers"
          value={metrics?.total_referrers ?? 0}
          icon={Users}
          loading={metricsLoading}
          back={{
            label: "Qualified",
            value: metrics?.qualified_count ?? 0,
            icon: ShieldCheck,
          }}
        />
        <AdminMetricCard
          variant="flip"
          label="Est. rewards"
          value={metrics ? formatReferralInr(metrics.estimated_earnings_inr) : "—"}
          icon={Coins}
          loading={metricsLoading}
          back={{
            label: "Engaged",
            value: metrics?.engaged_count ?? 0,
            icon: Sparkles,
          }}
        />
      </AdminMetricCardsGrid>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm"
          placeholder="Search referrer or code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setOffset(0);
              void refetch();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} aria-label="Refresh">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={loading}
            currentPageCount={items.length}
            hasMore={hasMore}
            onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))}
            onNext={() => setOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Referrer</AdminTableHeadCell>
            <AdminTableHeadCell>Code</AdminTableHeadCell>
            <AdminTableHeadCell>Clicks</AdminTableHeadCell>
            <AdminTableHeadCell>Referrals</AdminTableHeadCell>
            <AdminTableHeadCell>Est. earnings</AdminTableHeadCell>
            <AdminTableHeadCell>Paid out</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading && items.length === 0 ? (
            <AdminTableSkeletonRows columns={6} />
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={6}>No referrers match your search.</AdminTableStateRow>
          ) : (
            items.map((item) => (
              <AdminTableRow key={item.user?.user_id ?? item.display_name}>
                <AdminTableCell>
                  {item.user ? (
                    <>
                      <Link
                        href={referralReferrerDetailHref(item.user.client_id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.display_name}
                      </Link>
                      <p className="text-caption text-muted-foreground">{item.user.email}</p>
                    </>
                  ) : (
                    item.display_name
                  )}
                </AdminTableCell>
                <AdminTableCell>{item.referral_code ?? "—"}</AdminTableCell>
                <AdminTableCell>{item.click_count}</AdminTableCell>
                <AdminTableCell>{item.referral_count}</AdminTableCell>
                <AdminTableCell>{formatReferralInr(item.estimated_earnings_inr)}</AdminTableCell>
                <AdminTableCell>{formatReferralInr(item.paid_earnings_inr)}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
