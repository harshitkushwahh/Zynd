"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Layers, RefreshCw, Settings2, Sparkles, Star, XCircle } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { MfPipelineAutoPanel } from "@/components/mf/mf-pipeline-auto-panel";
import { NfoCategoryPanel } from "@/components/mf/nfo-category-panel";
import { NfoOperationsPanel } from "@/components/mf/nfo-operations-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { getErrorMessage } from "@/lib/errors";
import { fetchNfoOffers, patchNfoOffer, type NfoOfferAdmin } from "@/lib/mf-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

type NfoTab = "offers" | "category" | "operations";
type OfferFilter = "all" | "OPEN" | "UPCOMING" | "CLOSED" | "featured" | "stale_oms";

const OFFER_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All offers" },
  { value: "OPEN", label: "Open" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "CLOSED", label: "Closed" },
  { value: "featured", label: "Featured" },
  { value: "stale_oms", label: "Stale OMS" },
];

function offerStatusVariant(status: string): "success" | "info" | "neutral" | "warning" {
  if (status === "OPEN") return "success";
  if (status === "UPCOMING") return "info";
  if (status === "CLOSED") return "neutral";
  return "warning";
}

function isStaleOms(offer: NfoOfferAdmin) {
  return offer.status === "OPEN" && !offer.purchase_allowed;
}

function formatWindow(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  return `${start ?? "—"} → ${end ?? "—"}`;
}

export default function NfoAdminPage() {
  const { hasPermission } = useAdminAuth();
  const canRun = hasPermission("mf.jobs.run");
  const canRunPipeline = hasPermission("mf.pipeline.run");
  const canManage = hasPermission("mf.catalog.manage");
  const { activeTab, selectTab, keepMounted } = useMountedTabs<NfoTab>("offers");

  const [offers, setOffers] = useState<NfoOfferAdmin[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [offerFilter, setOfferFilter] = useState<OfferFilter>(ALL);
  const [offerPage, setOfferPage] = useState(0);
  const [offerPageSize, setOfferPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const offerPayload = await fetchNfoOffers();
      setOffers(offerPayload.items);
      setCounts(offerPayload.counts);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load NFO admin data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOffers = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    return offers.filter((offer) => {
      if (offerFilter === "OPEN" || offerFilter === "UPCOMING" || offerFilter === "CLOSED") {
        if (offer.status !== offerFilter) return false;
      } else if (offerFilter === "featured" && !offer.is_featured) {
        return false;
      } else if (offerFilter === "stale_oms" && !isStaleOms(offer)) {
        return false;
      }
      if (!query) return true;
      return [offer.fund_name, offer.scheme_name, offer.amc_name, offer.status, offer.product_id]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [listSearch, offerFilter, offers]);

  const offerPagination = useMemo(
    () => paginateItems(filteredOffers, offerPage, offerPageSize),
    [filteredOffers, offerPage, offerPageSize],
  );

  useEffect(() => {
    setOfferPage(0);
  }, [listSearch, offerFilter, offerPageSize]);

  async function toggleFeatured(offer: NfoOfferAdmin) {
    if (!canManage) return;
    setBusy(offer.product_id);
    try {
      await patchNfoOffer(offer.product_id, { is_featured: !offer.is_featured, admin_override: true });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update offer."));
    } finally {
      setBusy(null);
    }
  }

  const staleOms = counts.stale_oms ?? 0;

  return (
    <AdminSectionPageShell
      title="NFO"
      icon={Sparkles}
      breadcrumbSegments={[
        { label: "Mutual Funds", href: "/dashboard/mutual-funds" },
        { label: "NFO" },
      ]}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => selectTab(value as NfoTab)}
        className="gap-6"
      >
        <AdminTabList>
          <AdminTabTrigger value="offers" className="gap-2">
            <Sparkles className="size-4 shrink-0" />
            Offers
          </AdminTabTrigger>
          <AdminTabTrigger value="category" className="gap-2">
            <Layers className="size-4 shrink-0" />
            Category
          </AdminTabTrigger>
          <AdminTabTrigger value="operations" className="gap-2">
            <Settings2 className="size-4 shrink-0" />
            Operations
          </AdminTabTrigger>
        </AdminTabList>

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

        <TabsContent value="offers" keepMounted={keepMounted("offers")} className="mt-0 space-y-4">
          <AdminMetricCardsGrid columns="four">
            <AdminMetricCard
              label="Open"
              value={String(counts.OPEN ?? 0)}
              icon={Sparkles}
              tone="success"
              loading={loading}
              infoDescription="Offers currently in the subscription window."
            />
            <AdminMetricCard
              label="Upcoming"
              value={String(counts.UPCOMING ?? 0)}
              icon={CalendarClock}
              tone="info"
              loading={loading}
              infoDescription="Detected NFOs that have not opened yet."
            />
            <AdminMetricCard
              label="Closed"
              value={String(counts.CLOSED ?? 0)}
              icon={XCircle}
              tone="muted"
              loading={loading}
              infoDescription="Subscription window has ended."
            />
            <AdminMetricCard
              label="Featured"
              value={String(counts.featured ?? 0)}
              icon={Star}
              loading={loading}
              hint={staleOms > 0 ? `${staleOms} stale OMS` : undefined}
              infoDescription="Highlighted on the invest NFO surface."
              infoDetails={staleOms > 0 ? [`${staleOms} open offers are not purchasable in OMS.`] : undefined}
            />
          </AdminMetricCardsGrid>

          <MfPipelineAutoPanel
            family="nfo"
            canRun={canRunPipeline}
            onCompleted={() => void load()}
            onOpenCategoryTab={() => selectTab("category")}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AdminSearchInput
              containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
              placeholder="Search funds, AMC, or product"
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AdminSelect
                value={offerFilter}
                onValueChange={(value) => setOfferFilter(value as OfferFilter)}
                options={OFFER_FILTER_OPTIONS}
                placeholder="Status"
                className="min-w-select-sm"
                triggerClassName="w-auto"
              />
              {staleOms > 0 ? (
                <StatusBadge variant="warning" showIcon={false}>
                  {staleOms} stale OMS
                </StatusBadge>
              ) : null}
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          <AdminDataTable
            minWidth="4xl"
            footer={
              <AdminTablePagination
                page={offerPagination.page}
                totalPages={offerPagination.totalPages}
                hasPrevious={offerPagination.hasPrevious}
                hasNext={offerPagination.hasNext}
                disabled={loading}
                onPrevious={() => setOfferPage((current) => Math.max(0, current - 1))}
                onNext={() => setOfferPage((current) => current + 1)}
                pageSize={offerPageSize}
                onPageSizeChange={(next) => {
                  setOfferPageSize(next);
                  setOfferPage(0);
                }}
                totalCount={filteredOffers.length}
                currentPageCount={offerPagination.items.length}
              />
            }
          >
            <AdminTableHeader>
              <tr>
                {canManage ? (
                  <AdminTableHeadCell className="w-[5rem] text-right">Actions</AdminTableHeadCell>
                ) : null}
                <AdminTableHeadCell>Fund</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Window</AdminTableHeadCell>
                <AdminTableHeadCell>OMS</AdminTableHeadCell>
              </tr>
            </AdminTableHeader>
            <AdminTableBody>
              {loading ? (
                <AdminTableSkeletonRows columns={canManage ? 5 : 4} />
              ) : offerPagination.items.length === 0 ? (
                <AdminTableStateRow colSpan={canManage ? 5 : 4}>
                  {offers.length === 0 ? "No NFO offers yet." : "No offers match your search."}
                </AdminTableStateRow>
              ) : (
                offerPagination.items.map((offer) => (
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge variant={offerStatusVariant(offer.status)} showIcon={false}>
                          {offer.status}
                        </StatusBadge>
                        {offer.is_featured ? (
                          <StatusBadge variant="info" showIcon={false}>
                            Featured
                          </StatusBadge>
                        ) : null}
                      </div>
                    </AdminTableCell>
                    <AdminTableCell className="text-caption">
                      {formatWindow(offer.subscription_open_date, offer.subscription_close_date)}
                    </AdminTableCell>
                    <AdminTableCell>
                      {isStaleOms(offer) ? (
                        <StatusBadge variant="warning" showIcon={false}>
                          Stale
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant={offer.purchase_allowed ? "success" : "neutral"} showIcon={false}>
                          {offer.purchase_allowed ? "Purchase on" : "Off"}
                        </StatusBadge>
                      )}
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="category" keepMounted={keepMounted("category")} className="mt-0">
          <NfoCategoryPanel canManage={canManage} />
        </TabsContent>

        <TabsContent value="operations" keepMounted={keepMounted("operations")} className="mt-0">
          <NfoOperationsPanel canRunJobs={canRun} />
        </TabsContent>
      </Tabs>
    </AdminSectionPageShell>
  );
}
