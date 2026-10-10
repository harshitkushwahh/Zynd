"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, RefreshCw, Sparkles, Star } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableSkeletonRows,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchNfoCategory,
  patchNfoOffer,
  type NfoCategoryGroup,
  type NfoOfferAdmin,
} from "@/lib/mf-admin-api";

const ALL = "all";

function offerStatusVariant(status: string): "success" | "info" | "neutral" | "warning" {
  if (status === "OPEN") return "success";
  if (status === "UPCOMING") return "info";
  if (status === "CLOSED") return "neutral";
  return "warning";
}

export function NfoCategoryPanel({ canManage }: { canManage: boolean }) {
  const [groups, setGroups] = useState<NfoCategoryGroup[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchNfoCategory();
      setGroups(payload.groups);
      setCounts(payload.counts);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load NFO scheme categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo<AdminSelectOption[]>(() => {
    return [
      { value: ALL, label: "All scheme categories" },
      ...groups.map((group) => ({
        value: group.slug ?? "unclassified",
        label: `${group.name} (${group.count})`,
      })),
    ];
  }, [groups]);

  const offers = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const filteredOffers = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    return offers.filter((offer) => {
      const slug = offer.scheme_category_slug ?? "unclassified";
      if (categoryFilter !== ALL && slug !== categoryFilter) return false;
      if (!query) return true;
      return [
        offer.fund_name,
        offer.scheme_name,
        offer.amc_name,
        offer.scheme_category_name,
        offer.sebi_category,
        offer.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categoryFilter, listSearch, offers]);

  const pagination = useMemo(
    () => paginateItems(filteredOffers, page, pageSize),
    [filteredOffers, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [listSearch, categoryFilter, pageSize]);

  async function toggleFeatured(offer: NfoOfferAdmin) {
    if (!canManage) return;
    setBusy(offer.product_id);
    setError("");
    setMessage("");
    try {
      await patchNfoOffer(offer.product_id, { is_featured: !offer.is_featured, admin_override: true });
      setMessage(offer.is_featured ? "Removed from featured." : "Marked featured.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update offer."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}
      {message ? (
        <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>
          {message}
        </AdminFeedbackMessage>
      ) : null}

      <AdminMetricCardsGrid columns="four">
        <AdminMetricCard
          label="Scheme categories"
          value={String(counts.categories ?? 0)}
          icon={Layers}
          loading={loading}
          infoDescription="AMFI/SEBI scheme categories that fetched NFOs belong to. Membership is automatic."
        />
        <AdminMetricCard
          label="Classified"
          value={String(counts.classified ?? 0)}
          icon={Sparkles}
          tone="success"
          loading={loading}
        />
        <AdminMetricCard
          label="Unclassified"
          value={String(counts.unclassified ?? 0)}
          icon={Layers}
          tone={(counts.unclassified ?? 0) > 0 ? "warning" : "muted"}
          loading={loading}
          infoDescription="Fetched NFOs with no SEBI category yet. They appear after scheme ingest, not by UUID."
        />
        <AdminMetricCard
          label="Featured"
          value={String(counts.featured ?? 0)}
          icon={Star}
          loading={loading}
        />
      </AdminMetricCardsGrid>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
          placeholder="Search scheme, AMC, or category"
          value={listSearch}
          onChange={(event) => setListSearch(event.target.value)}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            options={categoryOptions}
          />
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
        </div>
      </div>

      <AdminDataTable>
        <AdminTableHeader>
          <tr>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
            <AdminTableHeadCell>Scheme</AdminTableHeadCell>
            <AdminTableHeadCell>Scheme category</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>SEBI label</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={canManage ? 5 : 4} />
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 5 : 4}>
              {offers.length === 0
                ? "No fetched NFOs yet. Run lifecycle sync — offers are not added by UUID."
                : "No NFOs match this scheme category."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((offer) => (
              <AdminTableRow key={offer.id}>
                {canManage ? (
                  <AdminTableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === offer.product_id}
                      onClick={() => void toggleFeatured(offer)}
                    >
                      {offer.is_featured ? "Unfeature" : "Feature"}
                    </Button>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <div className="font-medium">{offer.fund_name}</div>
                  <div className="text-caption text-muted-foreground">{offer.amc_name}</div>
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={offer.scheme_category_slug ? "info" : "warning"} showIcon={false}>
                    {offer.scheme_category_name ?? "Unclassified"}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={offerStatusVariant(offer.status)} showIcon={false}>
                    {offer.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-caption text-muted-foreground">
                  {offer.sebi_category ?? "—"}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
      <AdminTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        hasPrevious={pagination.hasPrevious}
        hasNext={pagination.hasNext}
        disabled={loading}
        totalCount={filteredOffers.length}
        currentPageCount={pagination.items.length}
        pageSize={pageSize}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(0);
        }}
        onPrevious={() => setPage((current) => Math.max(0, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />
    </div>
  );
}
