"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Repeat2, ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import { AmcLogo } from "@/components/mf/amc-logo";
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
  AdminTableRows,
  paginateItems,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { AdminUserInvestmentsDetail } from "@/lib/admin-api";
import { orderStatusVariant } from "@/components/users/user-status-badge";

type InvestmentRecord = Record<string, unknown>;

const ALL = "all";

const INVESTMENT_TABS = [
  { value: "cart", label: "Cart", icon: ShoppingCart },
  { value: "purchases", label: "Purchased funds", icon: TrendingUp },
  { value: "transactions", label: "Transactions", icon: Wallet },
  { value: "sip", label: "SIP plans", icon: Repeat2 },
  { value: "holdings", label: "Holdings", icon: Landmark },
] as const;

type InvestmentTab = (typeof INVESTMENT_TABS)[number]["value"];

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stringValue(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function recordSearchText(record: InvestmentRecord, fields: string[]) {
  return fields
    .map((field) => String(record[field] ?? ""))
    .join(" ")
    .toLowerCase();
}

function matchesSearch(record: InvestmentRecord, query: string, fields: string[]) {
  if (!query) return true;
  return recordSearchText(record, fields).includes(query);
}

function buildFieldFilterOptions(
  items: InvestmentRecord[],
  field: string,
  allLabel: string,
  formatLabel?: (value: string) => string,
): AdminSelectOption[] {
  const values = [...new Set(items.map((item) => String(item[field] ?? "").trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }),
  );

  return [
    { value: ALL, label: allLabel },
    ...values.map((value) => ({
      value: value.toLowerCase(),
      label: formatLabel ? formatLabel(value) : value,
    })),
  ];
}

function InvestmentFundCell({
  name,
  amcLogoUrl,
  amcName,
  subtitle,
}: {
  name: string;
  amcLogoUrl?: string | null;
  amcName?: string | null;
  subtitle?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AmcLogo name={amcName ?? name} logoUrl={amcLogoUrl} size="sm" fallback="icon" />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{name}</p>
        {subtitle ? <p className="mt-0.5 truncate text-caption text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function InvestmentTabCountBadge({ count }: { count: number }) {
  return (
    <StatusBadge variant="neutral" showIcon={false} className="ml-0.5">
      {count}
    </StatusBadge>
  );
}

function InvestmentTabToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filterValue,
  onFilterChange,
  filterOptions,
  filterAriaLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: readonly AdminSelectOption[];
  filterAriaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <AdminSearchInput
        containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <AdminSelect
        value={filterValue}
        onValueChange={onFilterChange}
        options={filterOptions}
        aria-label={filterAriaLabel}
        className="min-w-select-sm sm:ml-auto"
        triggerClassName="w-auto"
      />
    </div>
  );
}

function usePaginatedRows<T>(rows: T[], resetKey: string) {
  const [page, setPage] = useState(0);
  const pagination = useMemo(() => paginateItems(rows, page, ADMIN_TABLE_PAGE_SIZE), [rows, page]);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  return {
    page: pagination.page,
    setPage,
    pageItems: pagination.items,
    totalPages: pagination.totalPages,
    hasPrevious: pagination.hasPrevious,
    hasNext: pagination.hasNext,
  };
}

function PaginatedTableFooter({
  page,
  setPage,
  totalPages,
  hasPrevious,
  hasNext,
  totalCount,
  currentPageCount,
}: {
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  totalCount: number;
  currentPageCount: number;
}) {
  if (totalCount === 0) return null;

  return (
    <AdminTablePagination
      page={page}
      totalPages={totalPages}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      totalCount={totalCount}
      currentPageCount={currentPageCount}
      onPrevious={() => setPage((current) => Math.max(0, current - 1))}
      onNext={() => setPage((current) => current + 1)}
      className="border-t border-border bg-muted/10 px-3 py-2"
    />
  );
}

function CartTabPanel({ items }: { items: InvestmentRecord[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);

  const typeOptions = useMemo(
    () =>
      buildFieldFilterOptions(items, "investment_type", "All types", (value) =>
        value.replaceAll("_", " "),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (typeFilter !== ALL && String(item.investment_type ?? "").toLowerCase() !== typeFilter) {
        return false;
      }
      return matchesSearch(item, query, ["product_name", "amc_name", "investment_type", "product_id"]);
    });
  }, [items, search, typeFilter]);

  const pagination = usePaginatedRows(filteredItems, `${search}:${typeFilter}`);

  return (
    <div className="space-y-3">
      <InvestmentTabToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search cart"
        filterValue={typeFilter}
        onFilterChange={setTypeFilter}
        filterOptions={typeOptions}
        filterAriaLabel="Filter by investment type"
      />
      <AdminDataTable
        minWidth="lg"
        footer={
          <PaginatedTableFooter
            {...pagination}
            totalCount={filteredItems.length}
            currentPageCount={pagination.pageItems.length}
            setPage={pagination.setPage}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>SIP day</AdminTableHeadCell>
            <AdminTableHeadCell>Added</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows colSpan={5} isEmpty={filteredItems.length === 0} emptyMessage="Cart is empty.">
            {pagination.pageItems.map((item) => (
              <AdminTableRow key={`${String(item.product_id)}-${String(item.investment_type)}`}>
                <AdminTableCell>
                  <InvestmentFundCell
                    name={stringValue(item.product_name ?? item.product_id)}
                    amcLogoUrl={item.amc_logo_url as string | null | undefined}
                    amcName={item.amc_name as string | null | undefined}
                  />
                </AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {stringValue(item.investment_type)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatInr(item.amount_inr)}</AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {item.installment_day ? String(item.installment_day) : "—"}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{formatDate(item.created_at)}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

function PurchasesTabPanel({ items }: { items: InvestmentRecord[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);

  const typeOptions = useMemo(
    () =>
      buildFieldFilterOptions(items, "order_type", "All types", (value) =>
        value.replaceAll("_", " "),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (typeFilter !== ALL && String(item.order_type ?? "").toLowerCase() !== typeFilter) {
        return false;
      }
      return matchesSearch(item, query, ["product_name", "amc_name", "order_type", "product_id"]);
    });
  }, [items, search, typeFilter]);

  const pagination = usePaginatedRows(filteredItems, `${search}:${typeFilter}`);

  return (
    <div className="space-y-3">
      <InvestmentTabToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search purchases"
        filterValue={typeFilter}
        onFilterChange={setTypeFilter}
        filterOptions={typeOptions}
        filterAriaLabel="Filter by order type"
      />
      <AdminDataTable
        minWidth="lg"
        footer={
          <PaginatedTableFooter
            {...pagination}
            totalCount={filteredItems.length}
            currentPageCount={pagination.pageItems.length}
            setPage={pagination.setPage}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Settled</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={4}
            isEmpty={filteredItems.length === 0}
            emptyMessage="No completed purchases yet."
          >
            {pagination.pageItems.map((order) => (
              <AdminTableRow key={String(order.order_id)}>
                <AdminTableCell>
                  <InvestmentFundCell
                    name={stringValue(order.product_name ?? order.product_id)}
                    amcLogoUrl={order.amc_logo_url as string | null | undefined}
                    amcName={order.amc_name as string | null | undefined}
                  />
                </AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {stringValue(order.order_type)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatInr(order.amount_inr)}</AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{formatDate(order.settled_at)}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

function TransactionsTabPanel({ items }: { items: InvestmentRecord[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);

  const statusOptions = useMemo(
    () => buildFieldFilterOptions(items, "status", "All statuses", (value) => value.toUpperCase()),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (statusFilter !== ALL && String(item.status ?? "").toLowerCase() !== statusFilter) {
        return false;
      }
      return matchesSearch(item, query, [
        "product_name",
        "amc_name",
        "order_type",
        "status",
        "failure_reason",
        "product_id",
      ]);
    });
  }, [items, search, statusFilter]);

  const pagination = usePaginatedRows(filteredItems, `${search}:${statusFilter}`);

  return (
    <div className="space-y-3">
      <InvestmentTabToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transactions"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={statusOptions}
        filterAriaLabel="Filter by status"
      />
      <AdminDataTable
        minWidth="2xl"
        footer={
          <PaginatedTableFooter
            {...pagination}
            totalCount={filteredItems.length}
            currentPageCount={pagination.pageItems.length}
            setPage={pagination.setPage}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
            <AdminTableHeadCell>Failure</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows colSpan={6} isEmpty={filteredItems.length === 0} emptyMessage="No transactions found.">
            {pagination.pageItems.map((order) => (
              <AdminTableRow key={String(order.order_id)}>
                <AdminTableCell>
                  <InvestmentFundCell
                    name={stringValue(order.product_name ?? order.product_id)}
                    amcLogoUrl={order.amc_logo_url as string | null | undefined}
                    amcName={order.amc_name as string | null | undefined}
                  />
                </AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {stringValue(order.order_type)}
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatInr(order.amount_inr)}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={orderStatusVariant(String(order.status ?? ""))}>
                    {stringValue(order.status)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{formatDate(order.created_at)}</AdminTableCell>
                <AdminTableCell className="max-w-[12rem] truncate text-muted-foreground">
                  {order.failure_reason ? String(order.failure_reason) : "—"}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

function SipPlansTabPanel({ items }: { items: InvestmentRecord[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);

  const statusOptions = useMemo(
    () => buildFieldFilterOptions(items, "status", "All statuses", (value) => value.toUpperCase()),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (statusFilter !== ALL && String(item.status ?? "").toLowerCase() !== statusFilter) {
        return false;
      }
      return matchesSearch(item, query, ["product_name", "amc_name", "frequency", "status", "product_id"]);
    });
  }, [items, search, statusFilter]);

  const pagination = usePaginatedRows(filteredItems, `${search}:${statusFilter}`);

  return (
    <div className="space-y-3">
      <InvestmentTabToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search SIP plans"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={statusOptions}
        filterAriaLabel="Filter by status"
      />
      <AdminDataTable
        minWidth="2xl"
        footer={
          <PaginatedTableFooter
            {...pagination}
            totalCount={filteredItems.length}
            currentPageCount={pagination.pageItems.length}
            setPage={pagination.setPage}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Frequency</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Next installment</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows colSpan={5} isEmpty={filteredItems.length === 0} emptyMessage="No SIP plans found.">
            {pagination.pageItems.map((plan) => (
              <AdminTableRow key={String(plan.plan_id)}>
                <AdminTableCell>
                  <InvestmentFundCell
                    name={stringValue(plan.product_name ?? plan.product_id)}
                    amcLogoUrl={plan.amc_logo_url as string | null | undefined}
                    amcName={plan.amc_name as string | null | undefined}
                  />
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatInr(plan.amount_inr)}</AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {stringValue(plan.frequency)}
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={orderStatusVariant(String(plan.status ?? ""))}>
                    {stringValue(plan.status)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatDate(plan.next_installment_date)}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

function HoldingsTabPanel({ items }: { items: InvestmentRecord[] }) {
  const [search, setSearch] = useState("");
  const [amcFilter, setAmcFilter] = useState(ALL);

  const amcOptions = useMemo(
    () => buildFieldFilterOptions(items, "amc_name", "All AMCs"),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (amcFilter !== ALL && String(item.amc_name ?? "").toLowerCase() !== amcFilter) {
        return false;
      }
      return matchesSearch(item, query, [
        "scheme_name",
        "matched_scheme_name",
        "amc_name",
        "folio_number",
        "isin",
      ]);
    });
  }, [items, search, amcFilter]);

  const pagination = usePaginatedRows(filteredItems, `${search}:${amcFilter}`);

  return (
    <div className="space-y-3">
      <InvestmentTabToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search holdings"
        filterValue={amcFilter}
        onFilterChange={setAmcFilter}
        filterOptions={amcOptions}
        filterAriaLabel="Filter by AMC"
      />
      <AdminDataTable
        minWidth="2xl"
        footer={
          <PaginatedTableFooter
            {...pagination}
            totalCount={filteredItems.length}
            currentPageCount={pagination.pageItems.length}
            setPage={pagination.setPage}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Scheme</AdminTableHeadCell>
            <AdminTableHeadCell>Folio</AdminTableHeadCell>
            <AdminTableHeadCell>Units</AdminTableHeadCell>
            <AdminTableHeadCell>Value</AdminTableHeadCell>
            <AdminTableHeadCell>As of</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows colSpan={5} isEmpty={filteredItems.length === 0} emptyMessage="No holdings imported yet.">
            {pagination.pageItems.map((holding) => {
              const schemeName = stringValue(holding.scheme_name ?? holding.matched_scheme_name);
              return (
                <AdminTableRow key={`${String(holding.isin)}-${String(holding.folio_number)}`}>
                  <AdminTableCell>
                    <InvestmentFundCell
                      name={schemeName}
                      amcLogoUrl={holding.amc_logo_url as string | null | undefined}
                      amcName={holding.amc_name as string | null | undefined}
                      subtitle={holding.isin ? String(holding.isin) : null}
                    />
                  </AdminTableCell>
                  <AdminTableCell className="font-mono text-caption text-muted-foreground">
                    {stringValue(holding.folio_number)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums text-muted-foreground">
                    {stringValue(holding.units)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">{formatInr(holding.market_value_inr)}</AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">{formatDate(holding.as_of_date)}</AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTableRows>
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

function countActiveSipPlans(plans: InvestmentRecord[]) {
  return plans.filter((plan) => String(plan.status ?? "").toLowerCase() === "active").length;
}

function sipPlansHint(plans: InvestmentRecord[]) {
  const activeCount = countActiveSipPlans(plans);
  if (plans.length === 0) return "No SIP plans";
  if (activeCount === 0) return "No active plans";
  return activeCount === 1 ? "1 active plan" : `${activeCount} active plans`;
}

export function UserInvestmentsDetailSection({
  investments,
}: {
  investments: AdminUserInvestmentsDetail;
}) {
  const [activeTab, setActiveTab] = useState<InvestmentTab>("cart");

  const cartItems = investments.cart.items ?? [];
  const orders = investments.orders ?? [];
  const purchases = investments.purchases ?? [];
  const holdings = investments.holdings ?? [];
  const sipPlans = investments.sip_plans ?? [];

  const tabCounts: Record<InvestmentTab, number> = {
    cart: cartItems.length,
    purchases: purchases.length,
    transactions: orders.length,
    sip: sipPlans.length,
    holdings: holdings.length,
  };

  const activeTabMeta = INVESTMENT_TABS.find((tab) => tab.value === activeTab) ?? INVESTMENT_TABS[0];

  return (
    <div className="admin-user-investments space-y-4">
      <AdminMetricCardsGrid columns="four" className="admin-user-investments__metrics">
        <AdminMetricCard
          accent
          icon={ShoppingCart}
          label="Cart items"
          value={String(investments.cart.item_count)}
          hint={formatInr(investments.cart.total_amount_inr)}
        />
        <AdminMetricCard
          icon={TrendingUp}
          label="Purchases"
          value={String(purchases.length)}
          hint="Completed orders"
        />
        <AdminMetricCard
          icon={Repeat2}
          label="SIP plans"
          value={String(sipPlans.length)}
          hint={sipPlansHint(sipPlans)}
        />
        <AdminMetricCard
          icon={Landmark}
          label="Holdings"
          value={String(holdings.length)}
          hint="Imported schemes"
        />
      </AdminMetricCardsGrid>

      <section className="admin-user-investments__tabs-section space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as InvestmentTab)}
          className="gap-3"
        >
          <div className="admin-user-family-group-detail__section-head">
            <h2 className="admin-user-family-group-detail__section-title">{activeTabMeta.label}</h2>
            <AdminTabList variant="secondary" className="admin-user-investments__tabs">
              {INVESTMENT_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger key={tab.value} value={tab.value} className="gap-2">
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                    <InvestmentTabCountBadge count={tabCounts[tab.value]} />
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>
          </div>

          <TabsContent value="cart" className="mt-0">
            <CartTabPanel items={cartItems} />
          </TabsContent>
          <TabsContent value="purchases" className="mt-0">
            <PurchasesTabPanel items={purchases} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-0">
            <TransactionsTabPanel items={orders} />
          </TabsContent>
          <TabsContent value="sip" className="mt-0">
            <SipPlansTabPanel items={sipPlans} />
          </TabsContent>
          <TabsContent value="holdings" className="mt-0">
            <HoldingsTabPanel items={holdings} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
