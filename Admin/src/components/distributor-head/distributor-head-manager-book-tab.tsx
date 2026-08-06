"use client";

import { useMemo, useState } from "react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import type {
  DistributorHeadBookPurchase,
  DistributorHeadBookSipPlan,
} from "@/lib/dummy/distributor-head-data";
import type { ManagerBookSummary } from "@/lib/distributor-head-queries";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { IndianRupee, Repeat, ShoppingBag } from "lucide-react";

const ALL = "all";
const SIP_COLUMNS = 7;
const PURCHASE_COLUMNS = 6;

const SIP_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

const PURCHASE_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

function sipStatusVariant(status: DistributorHeadBookSipPlan["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}

function purchaseStatusVariant(status: DistributorHeadBookPurchase["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "pending") return "info" as const;
  return "neutral" as const;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DistributorHeadManagerBookTab({
  book,
  sips,
  purchases,
}: {
  book: ManagerBookSummary;
  sips: DistributorHeadBookSipPlan[];
  purchases: DistributorHeadBookPurchase[];
}) {
  const [bookView, setBookView] = useState<"sips" | "lumpsum">("sips");
  const [sipSearch, setSipSearch] = useState("");
  const [sipStatus, setSipStatus] = useState(ALL);
  const [sipPage, setSipPage] = useState(0);
  const [sipPageSize, setSipPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState(ALL);
  const [purchasePage, setPurchasePage] = useState(0);
  const [purchasePageSize, setPurchasePageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const filteredSips = useMemo(() => {
    const query = sipSearch.trim().toLowerCase();
    return sips.filter((row) => {
      if (sipStatus !== ALL && row.status !== sipStatus) return false;
      if (!query) return true;
      return [row.clientName, row.distributorName, row.schemeName]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [sipSearch, sipStatus, sips]);

  const filteredPurchases = useMemo(() => {
    const query = purchaseSearch.trim().toLowerCase();
    return purchases.filter((row) => {
      if (purchaseStatus !== ALL && row.status !== purchaseStatus) return false;
      if (!query) return true;
      return [row.clientName, row.distributorName, row.schemeName]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [purchaseSearch, purchaseStatus, purchases]);

  const sipPagination = useMemo(
    () => paginateItems(filteredSips, sipPage, sipPageSize),
    [filteredSips, sipPage, sipPageSize],
  );

  const purchasePagination = useMemo(
    () => paginateItems(filteredPurchases, purchasePage, purchasePageSize),
    [filteredPurchases, purchasePage, purchasePageSize],
  );

  const totalMtd = book.lumpsumMtdInr + book.sipMtdInr;
  const lumpsumShare = totalMtd > 0 ? Math.round((book.lumpsumMtdInr / totalMtd) * 100) : 0;

  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={IndianRupee}
          label="Total AUM"
          value={formatDistributorHeadInr(book.totalAumInr)}
          hint={`Combined ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()} books`}
          tone="success"
          accent
        />
        <AdminMetricCard
          icon={Repeat}
          label="Active SIPs"
          value={String(book.activeSipCount)}
          hint={`${formatDistributorHeadInr(book.sipCommitmentMonthlyInr)}/month`}
          tone="info"
        />
        <AdminMetricCard
          icon={ShoppingBag}
          label="Lumpsum MTD"
          value={formatDistributorHeadInr(book.lumpsumMtdInr)}
          hint={`${lumpsumShare}% of MTD flows`}
          tone="default"
        />
        <AdminMetricCard
          icon={Repeat}
          label="SIP MTD"
          value={formatDistributorHeadInr(book.sipMtdInr)}
          hint={`Total MTD ${formatDistributorHeadInr(totalMtd)}`}
          tone="muted"
        />
      </AdminMetricCardsGrid>

      <Tabs
        value={bookView}
        onValueChange={(value) => {
          if (value === "sips" || value === "lumpsum") setBookView(value);
        }}
        className="gap-4"
      >
        <AdminTabList variant="secondary">
          <AdminTabTrigger value="sips">SIP plans ({sips.length})</AdminTabTrigger>
          <AdminTabTrigger value="lumpsum">Lumpsum ({purchases.length})</AdminTabTrigger>
        </AdminTabList>

        <TabsContent value="sips" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <AdminSearchInput
              containerClassName="max-w-sm"
              placeholder={`Search SIPs by client, ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()}, or scheme`}
              value={sipSearch}
              onChange={(event) => {
                setSipSearch(event.target.value);
                setSipPage(0);
              }}
            />
            <AdminSelect
              value={sipStatus}
              onValueChange={(value) => {
                setSipStatus(value);
                setSipPage(0);
              }}
              options={SIP_STATUS_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
            />
          </div>

          <AdminDataTable
            minWidth="5xl"
            footer={
              <AdminTablePagination
                page={sipPagination.page}
                totalPages={sipPagination.totalPages}
                hasPrevious={sipPagination.hasPrevious}
                hasNext={sipPagination.hasNext}
                totalCount={filteredSips.length}
                currentPageCount={sipPagination.items.length}
                pageSize={sipPageSize}
                onPageSizeChange={(next) => {
                  setSipPageSize(next);
                  setSipPage(0);
                }}
                onPrevious={() => setSipPage((p) => Math.max(0, p - 1))}
                onNext={() => setSipPage((p) => p + 1)}
              />
            }
          >
            <AdminTableHeader>
              <tr>
                <AdminTableHeadCell>Client</AdminTableHeadCell>
                <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
                <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                <AdminTableHeadCell>Amount</AdminTableHeadCell>
                <AdminTableHeadCell>Frequency</AdminTableHeadCell>
                <AdminTableHeadCell>Next installment</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
              </tr>
            </AdminTableHeader>
            <AdminTableBody>
              {sipPagination.items.length === 0 ? (
                <AdminTableStateRow colSpan={SIP_COLUMNS}>No SIP plans found.</AdminTableStateRow>
              ) : (
                sipPagination.items.map((row) => (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell className="font-medium">{row.clientName}</AdminTableCell>
                    <AdminTableCell>{row.distributorName}</AdminTableCell>
                    <AdminTableCell>{row.schemeName}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {formatDistributorHeadInr(row.amountInr)}
                    </AdminTableCell>
                    <AdminTableCell className="capitalize">{row.frequency}</AdminTableCell>
                    <AdminTableCell>{formatDate(row.nextInstallmentDate)}</AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={sipStatusVariant(row.status)} showIcon={false}>
                        {row.status}
                      </StatusBadge>
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="lumpsum" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <AdminSearchInput
              containerClassName="max-w-sm"
              placeholder={`Search purchases by client, ${MITRA_HIERARCHY_COPY.zyndMitra.toLowerCase()}, or scheme`}
              value={purchaseSearch}
              onChange={(event) => {
                setPurchaseSearch(event.target.value);
                setPurchasePage(0);
              }}
            />
            <AdminSelect
              value={purchaseStatus}
              onValueChange={(value) => {
                setPurchaseStatus(value);
                setPurchasePage(0);
              }}
              options={PURCHASE_STATUS_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
            />
          </div>

          <AdminDataTable
            minWidth="5xl"
            footer={
              <AdminTablePagination
                page={purchasePagination.page}
                totalPages={purchasePagination.totalPages}
                hasPrevious={purchasePagination.hasPrevious}
                hasNext={purchasePagination.hasNext}
                totalCount={filteredPurchases.length}
                currentPageCount={purchasePagination.items.length}
                pageSize={purchasePageSize}
                onPageSizeChange={(next) => {
                  setPurchasePageSize(next);
                  setPurchasePage(0);
                }}
                onPrevious={() => setPurchasePage((p) => Math.max(0, p - 1))}
                onNext={() => setPurchasePage((p) => p + 1)}
              />
            }
          >
            <AdminTableHeader>
              <tr>
                <AdminTableHeadCell>Client</AdminTableHeadCell>
                <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitra}</AdminTableHeadCell>
                <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                <AdminTableHeadCell>Amount</AdminTableHeadCell>
                <AdminTableHeadCell>Order date</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
              </tr>
            </AdminTableHeader>
            <AdminTableBody>
              {purchasePagination.items.length === 0 ? (
                <AdminTableStateRow colSpan={PURCHASE_COLUMNS}>
                  No lumpsum purchases found.
                </AdminTableStateRow>
              ) : (
                purchasePagination.items.map((row) => (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell className="font-medium">{row.clientName}</AdminTableCell>
                    <AdminTableCell>{row.distributorName}</AdminTableCell>
                    <AdminTableCell>{row.schemeName}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {formatDistributorHeadInr(row.amountInr)}
                    </AdminTableCell>
                    <AdminTableCell>{formatDate(row.orderDate)}</AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={purchaseStatusVariant(row.status)} showIcon={false}>
                        {row.status}
                      </StatusBadge>
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>
      </Tabs>
    </div>
  );
}
