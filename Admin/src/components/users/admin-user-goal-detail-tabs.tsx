"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Landmark,
  Receipt,
  Repeat,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import { AdminUserGoalPlanPanel } from "@/components/users/admin-user-goal-plan-panel";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type {
  AdminGoalInvestments,
  AdminUserGoal,
} from "@/lib/admin-api";
import type { AdminFamilyGroupActivity } from "@/lib/family-groups-admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { formatInr } from "@/lib/format-inr";

type AdminUserGoalDetailTabsProps = {
  goal: AdminUserGoal;
  investments: AdminGoalInvestments | null;
  investmentsLoading: boolean;
  goalActivity: AdminFamilyGroupActivity[];
  funding: {
    progress: number;
    declared: number;
    contributed: number;
    remaining: number;
  };
  isFamilyGoal: boolean;
};

const DETAIL_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "holdings", label: "Holdings", icon: Landmark },
  { value: "sips", label: "SIPs", icon: Repeat },
  { value: "orders", label: "Orders", icon: Receipt },
  { value: "plan", label: "Plan", icon: Calculator },
  { value: "history", label: "History", icon: ScrollText },
];

function formatHoldingDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatActivityEventType(eventType: string) {
  return eventType
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSourceType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const HOLDINGS_OWNER_FILTER_DEFAULT: AdminSelectOption = { value: "all", label: "All owners" };
const HOLDINGS_AMC_FILTER_DEFAULT: AdminSelectOption = { value: "all", label: "All AMCs" };
const SIPS_STATUS_FILTER_DEFAULT: AdminSelectOption = { value: "all", label: "All statuses" };
const ORDERS_TYPE_FILTER_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All types" },
  { value: "order", label: "Orders" },
  { value: "contribution", label: "Contributions" },
];
const ORDERS_STATUS_FILTER_DEFAULT: AdminSelectOption = { value: "all", label: "All statuses" };
const HISTORY_EVENT_FILTER_DEFAULT: AdminSelectOption = { value: "all", label: "All events" };

type GoalHistoryRow = {
  id: string;
  eventKey: string;
  eventLabel: string;
  details: string;
  when: string | null;
};

function matchesHistorySearch(row: GoalHistoryRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [row.eventLabel, row.details, row.when ? formatTimestampDetail(row.when) : ""].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function buildGoalHistoryRows(
  goal: AdminUserGoal,
  goalActivity: AdminFamilyGroupActivity[],
  progressPct: number,
): GoalHistoryRow[] {
  const rows: GoalHistoryRow[] = [];

  if (goal.created_at) {
    rows.push({
      id: "goal-created",
      eventKey: "goal.created",
      eventLabel: "Goal created",
      details: `Initial target ${formatInr(goal.target_amount_inr)}`,
      when: goal.created_at,
    });
  }

  if (goal.updated_at && goal.updated_at !== goal.created_at) {
    rows.push({
      id: "goal-updated",
      eventKey: "goal.updated",
      eventLabel: "Last updated",
      details: `Status ${goal.status} · ${Math.round(progressPct)}% progress`,
      when: goal.updated_at,
    });
  }

  for (const entry of goalActivity) {
    rows.push({
      id: entry.id,
      eventKey: entry.event_type,
      eventLabel: formatActivityEventType(entry.event_type),
      details: entry.message,
      when: entry.created_at,
    });
  }

  rows.sort((left, right) => (right.when ?? "").localeCompare(left.when ?? ""));
  return rows;
}

function matchesHoldingSearch(
  holding: AdminGoalInvestments["holdings"][number],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    holding.scheme_name,
    holding.matched_scheme_name,
    holding.folio_number,
    holding.isin,
    holding.owner_display_name,
    holding.amc_name,
  ].some((value) => (value ?? "").toLowerCase().includes(normalized));
}

function matchesSipSearch(plan: AdminGoalInvestments["sip_plans"][number], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [plan.product_name, plan.owner_display_name, plan.frequency, plan.status].some((value) =>
    (value ?? "").toLowerCase().includes(normalized),
  );
}

function matchesOrderSearch(order: AdminGoalInvestments["orders"][number], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [order.product_name, order.owner_display_name, order.order_type, order.status].some(
    (value) => (value ?? "").toLowerCase().includes(normalized),
  );
}

function formatOrderType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatOrderStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminUserGoalDetailTabs({
  goal,
  investments,
  investmentsLoading,
  goalActivity,
  funding,
  isFamilyGoal,
}: AdminUserGoalDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("holdings");
  const [holdingsSearch, setHoldingsSearch] = useState("");
  const [holdingsOwnerFilter, setHoldingsOwnerFilter] = useState("all");
  const [holdingsAmcFilter, setHoldingsAmcFilter] = useState("all");
  const [sipsSearch, setSipsSearch] = useState("");
  const [sipsStatusFilter, setSipsStatusFilter] = useState("all");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersTypeFilter, setOrdersTypeFilter] = useState("all");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyEventFilter, setHistoryEventFilter] = useState("all");
  const [holdingsPage, setHoldingsPage] = useState(0);
  const [sipsPage, setSipsPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const linkedProduct = investments?.linked_product ?? null;
  const holdings = investments?.holdings ?? [];
  const sipPlans = investments?.sip_plans ?? [];
  const orders = investments?.orders ?? [];
  const contributions = investments?.contributions ?? [];

  useEffect(() => {
    setHoldingsPage(0);
  }, [holdingsSearch, holdingsOwnerFilter, holdingsAmcFilter]);

  useEffect(() => {
    setSipsPage(0);
  }, [sipsSearch, sipsStatusFilter]);

  useEffect(() => {
    setOrdersPage(0);
  }, [ordersSearch, ordersTypeFilter, ordersStatusFilter]);

  useEffect(() => {
    setHistoryPage(0);
  }, [historySearch, historyEventFilter]);

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setHoldingsPage(0);
    setSipsPage(0);
    setOrdersPage(0);
    setHistoryPage(0);
  }

  const holdingsOwnerOptions = useMemo<AdminSelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const holding of holdings) {
      if (!seen.has(holding.user_id)) {
        seen.set(holding.user_id, holding.owner_display_name);
      }
    }
    return [
      HOLDINGS_OWNER_FILTER_DEFAULT,
      ...[...seen.entries()].map(([userId, label]) => ({ value: userId, label })),
    ];
  }, [holdings]);

  const holdingsAmcOptions = useMemo<AdminSelectOption[]>(() => {
    const amcs = [...new Set(holdings.map((holding) => holding.amc_name).filter(Boolean))].sort() as string[];
    return [
      HOLDINGS_AMC_FILTER_DEFAULT,
      ...amcs.map((amc) => ({ value: amc, label: amc })),
    ];
  }, [holdings]);

  const sipsStatusOptions = useMemo<AdminSelectOption[]>(() => {
    const statuses = [...new Set(sipPlans.map((plan) => plan.status))].sort();
    return [
      SIPS_STATUS_FILTER_DEFAULT,
      ...statuses.map((status) => ({ value: status, label: formatOrderStatus(status) })),
    ];
  }, [sipPlans]);

  const ordersStatusOptions = useMemo<AdminSelectOption[]>(() => {
    const statuses = [...new Set(orders.map((order) => order.status))].sort();
    return [
      ORDERS_STATUS_FILTER_DEFAULT,
      ...statuses.map((status) => ({ value: status, label: formatOrderStatus(status) })),
    ];
  }, [orders]);

  const historyRows = useMemo(
    () => buildGoalHistoryRows(goal, goalActivity, funding.progress),
    [goal, goalActivity, funding.progress],
  );

  const historyEventOptions = useMemo<AdminSelectOption[]>(() => {
    const types = [...new Set(historyRows.map((row) => row.eventKey))];
    return [
      HISTORY_EVENT_FILTER_DEFAULT,
      ...types.map((type) => ({
        value: type,
        label: historyRows.find((row) => row.eventKey === type)?.eventLabel ?? type,
      })),
    ];
  }, [historyRows]);

  const filteredHoldings = useMemo(
    () =>
      holdings.filter((holding) => {
        if (isFamilyGoal && holdingsOwnerFilter !== "all" && holding.user_id !== holdingsOwnerFilter) {
          return false;
        }
        if (!isFamilyGoal && holdingsAmcFilter !== "all" && holding.amc_name !== holdingsAmcFilter) {
          return false;
        }
        return matchesHoldingSearch(holding, holdingsSearch);
      }),
    [holdings, holdingsAmcFilter, holdingsOwnerFilter, holdingsSearch, isFamilyGoal],
  );

  const filteredSips = useMemo(
    () =>
      sipPlans.filter((plan) => {
        if (sipsStatusFilter !== "all" && plan.status !== sipsStatusFilter) return false;
        return matchesSipSearch(plan, sipsSearch);
      }),
    [sipPlans, sipsSearch, sipsStatusFilter],
  );

  const filteredOrders = useMemo(() => {
    const orderRows = orders.filter((order) => {
      if (ordersStatusFilter !== "all" && order.status !== ordersStatusFilter) return false;
      return matchesOrderSearch(order, ordersSearch);
    });
    const contributionRows = contributions.filter((entry) => {
      const normalized = ordersSearch.trim().toLowerCase();
      if (!normalized) return true;
      return [entry.owner_display_name, entry.source_type, entry.note].some((value) =>
        (value ?? "").toLowerCase().includes(normalized),
      );
    });
    return { orders: orderRows, contributions: contributionRows };
  }, [contributions, orders, ordersSearch, ordersStatusFilter]);

  const holdingsPagination = useMemo(
    () => paginateItems(filteredHoldings, holdingsPage, pageSize),
    [filteredHoldings, holdingsPage, pageSize],
  );

  const sipsPagination = useMemo(
    () => paginateItems(filteredSips, sipsPage, pageSize),
    [filteredSips, sipsPage, pageSize],
  );

  const mergedOrderRows = useMemo(() => {
    const rows: Array<
      | { kind: "order"; key: string; createdAt: string | null; row: (typeof orders)[number] }
      | { kind: "contribution"; key: string; createdAt: string | null; row: (typeof contributions)[number] }
    > = [];

    if (ordersTypeFilter === "all" || ordersTypeFilter === "order") {
      rows.push(
        ...filteredOrders.orders.map((row) => ({
          kind: "order" as const,
          key: row.order_id,
          createdAt: row.created_at,
          row,
        })),
      );
    }

    if (ordersTypeFilter === "all" || ordersTypeFilter === "contribution") {
      rows.push(
        ...filteredOrders.contributions.map((row) => ({
          kind: "contribution" as const,
          key: row.id,
          createdAt: row.contributed_at,
          row,
        })),
      );
    }

    rows.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
    return rows;
  }, [filteredOrders.contributions, filteredOrders.orders, ordersTypeFilter]);

  const filteredHistoryRows = useMemo(
    () =>
      historyRows.filter((row) => {
        if (historyEventFilter !== "all" && row.eventKey !== historyEventFilter) return false;
        return matchesHistorySearch(row, historySearch);
      }),
    [historyEventFilter, historyRows, historySearch],
  );

  const historyPagination = useMemo(
    () => paginateItems(filteredHistoryRows, historyPage, pageSize),
    [filteredHistoryRows, historyPage, pageSize],
  );

  const ordersPagination = useMemo(
    () => paginateItems(mergedOrderRows, ordersPage, pageSize),
    [mergedOrderRows, ordersPage, pageSize],
  );

  const activeTabMeta = DETAIL_TABS.find((tab) => tab.value === activeTab) ?? DETAIL_TABS[0];
  const showOwnerColumn = isFamilyGoal;

  return (
    <section className="admin-user-goal-detail__tabs-section space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
        <div className="admin-user-family-group-detail__section-head">
          <h2 className="admin-user-family-group-detail__section-title">{activeTabMeta.label}</h2>
          <AdminTabList variant="secondary" className="admin-user-goal-detail__tabs">
            {DETAIL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.value} value={tab.value} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>
        </div>

        <TabsContent value="holdings" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search holdings"
              value={holdingsSearch}
              onChange={(event) => setHoldingsSearch(event.target.value)}
            />
            {isFamilyGoal ? (
              <AdminSelect
                value={holdingsOwnerFilter}
                onValueChange={setHoldingsOwnerFilter}
                options={holdingsOwnerOptions}
                aria-label="Filter by owner"
                triggerClassName="admin-user-family-group-detail__table-filter"
              />
            ) : (
              <AdminSelect
                value={holdingsAmcFilter}
                onValueChange={setHoldingsAmcFilter}
                options={holdingsAmcOptions}
                aria-label="Filter by AMC"
                triggerClassName="admin-user-family-group-detail__table-filter"
              />
            )}
          </div>

          <AdminDataTable
            minWidth="4xl"
            footer={
              <AdminTablePagination
                page={holdingsPagination.page}
                totalPages={holdingsPagination.totalPages}
                hasPrevious={holdingsPagination.hasPrevious}
                hasNext={holdingsPagination.hasNext}
                totalCount={filteredHoldings.length}
                currentPageCount={holdingsPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setHoldingsPage((page) => Math.max(0, page - 1))}
                onNext={() => setHoldingsPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Scheme</AdminTableHeadCell>
                {showOwnerColumn ? <AdminTableHeadCell>Owner</AdminTableHeadCell> : null}
                <AdminTableHeadCell>Folio</AdminTableHeadCell>
                <AdminTableHeadCell>Units</AdminTableHeadCell>
                <AdminTableHeadCell>NAV</AdminTableHeadCell>
                <AdminTableHeadCell>Current value</AdminTableHeadCell>
                <AdminTableHeadCell>As of</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={showOwnerColumn ? 7 : 6}
                isEmpty={filteredHoldings.length === 0}
                emptyMessage={
                  investmentsLoading
                    ? "Loading holdings…"
                    : linkedProduct
                      ? "No holdings recorded for the linked fund yet."
                      : "Link a mutual fund to this goal to track holdings here."
                }
              >
                {holdingsPagination.items.map((holding) => (
                  <AdminTableRow key={`${holding.holding_id}-${holding.folio_number}`}>
                    <AdminTableCell>
                      <div className="min-w-0">
                        <p className="truncate text-compact font-medium text-foreground">
                          {holding.matched_scheme_name ?? holding.scheme_name}
                        </p>
                        {holding.amc_name ? (
                          <p className="truncate text-caption text-muted-foreground">{holding.amc_name}</p>
                        ) : null}
                      </div>
                    </AdminTableCell>
                    {showOwnerColumn ? (
                      <AdminTableCell className="text-compact">{holding.owner_display_name}</AdminTableCell>
                    ) : null}
                    <AdminTableCell className="tabular-nums text-muted-foreground">
                      {holding.folio_number || "—"}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {holding.units.toLocaleString("en-IN")}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {holding.nav_value != null ? formatInr(holding.nav_value) : "—"}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{formatInr(holding.market_value_inr)}</AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                      {formatHoldingDate(holding.as_of_date)}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="sips" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search SIP plans"
              value={sipsSearch}
              onChange={(event) => setSipsSearch(event.target.value)}
            />
            <AdminSelect
              value={sipsStatusFilter}
              onValueChange={setSipsStatusFilter}
              options={sipsStatusOptions}
              aria-label="Filter by status"
              triggerClassName="admin-user-family-group-detail__table-filter"
            />
          </div>

          <AdminDataTable
            minWidth="3xl"
            footer={
              <AdminTablePagination
                page={sipsPagination.page}
                totalPages={sipsPagination.totalPages}
                hasPrevious={sipsPagination.hasPrevious}
                hasNext={sipsPagination.hasNext}
                totalCount={filteredSips.length}
                currentPageCount={sipsPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setSipsPage((page) => Math.max(0, page - 1))}
                onNext={() => setSipsPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Fund</AdminTableHeadCell>
                {showOwnerColumn ? <AdminTableHeadCell>Owner</AdminTableHeadCell> : null}
                <AdminTableHeadCell>Monthly amount</AdminTableHeadCell>
                <AdminTableHeadCell>Frequency</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Next installment</AdminTableHeadCell>
                <AdminTableHeadCell>Goal link</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={showOwnerColumn ? 7 : 6}
                isEmpty={filteredSips.length === 0}
                emptyMessage={
                  investmentsLoading
                    ? "Loading SIP plans…"
                    : "No SIP plans linked to this goal yet."
                }
              >
                {sipsPagination.items.map((plan) => (
                  <AdminTableRow key={plan.plan_id}>
                    <AdminTableCell>
                      <p className="truncate text-compact font-medium text-foreground">
                        {plan.product_name ?? "Fund"}
                      </p>
                    </AdminTableCell>
                    {showOwnerColumn ? (
                      <AdminTableCell className="text-compact">{plan.owner_display_name}</AdminTableCell>
                    ) : null}
                    <AdminTableCell className="tabular-nums font-medium">
                      {formatInr(plan.amount_inr)}
                    </AdminTableCell>
                    <AdminTableCell className="capitalize text-muted-foreground">{plan.frequency}</AdminTableCell>
                    <AdminTableCell>
                      <AdminFamilyGroupRoleBadge label={plan.status} kind="status" />
                    </AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                      {plan.next_installment_date
                        ? formatHoldingDate(plan.next_installment_date)
                        : "—"}
                    </AdminTableCell>
                    <AdminTableCell className="text-muted-foreground">
                      {plan.is_goal_linked ? "Direct" : "Via linked fund"}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="orders" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search orders and contributions"
              value={ordersSearch}
              onChange={(event) => setOrdersSearch(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <AdminSelect
                value={ordersTypeFilter}
                onValueChange={setOrdersTypeFilter}
                options={ORDERS_TYPE_FILTER_OPTIONS}
                aria-label="Filter by type"
                triggerClassName="admin-user-family-group-detail__table-filter"
              />
              <AdminSelect
                value={ordersStatusFilter}
                onValueChange={setOrdersStatusFilter}
                options={ordersStatusOptions}
                aria-label="Filter by status"
                triggerClassName="admin-user-family-group-detail__table-filter"
              />
            </div>
          </div>

          <AdminDataTable
            minWidth="3xl"
            footer={
              <AdminTablePagination
                page={ordersPagination.page}
                totalPages={ordersPagination.totalPages}
                hasPrevious={ordersPagination.hasPrevious}
                hasNext={ordersPagination.hasNext}
                totalCount={mergedOrderRows.length}
                currentPageCount={ordersPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setOrdersPage((page) => Math.max(0, page - 1))}
                onNext={() => setOrdersPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Type</AdminTableHeadCell>
                <AdminTableHeadCell>Details</AdminTableHeadCell>
                {showOwnerColumn ? <AdminTableHeadCell>Owner</AdminTableHeadCell> : null}
                <AdminTableHeadCell>Amount</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>When</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={showOwnerColumn ? 6 : 5}
                isEmpty={mergedOrderRows.length === 0}
                emptyMessage={
                  investmentsLoading
                    ? "Loading orders…"
                    : "No orders or contributions recorded for this goal yet."
                }
              >
                {ordersPagination.items.map((entry) =>
                  entry.kind === "order" ? (
                    <AdminTableRow key={entry.key}>
                      <AdminTableCell>{formatOrderType(entry.row.order_type)}</AdminTableCell>
                      <AdminTableCell>
                        <p className="truncate text-compact font-medium text-foreground">
                          {entry.row.product_name ?? "Mutual fund order"}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {entry.row.is_goal_linked ? "Goal-linked order" : "Linked fund order"}
                        </p>
                      </AdminTableCell>
                      {showOwnerColumn ? (
                        <AdminTableCell className="text-compact">{entry.row.owner_display_name}</AdminTableCell>
                      ) : null}
                      <AdminTableCell className="tabular-nums font-medium">
                        {formatInr(entry.row.amount_inr)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminFamilyGroupRoleBadge label={entry.row.status} kind="status" />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {entry.row.created_at ? formatTimestampDetail(entry.row.created_at) : "—"}
                      </AdminTableCell>
                    </AdminTableRow>
                  ) : (
                    <AdminTableRow key={entry.key}>
                      <AdminTableCell>Contribution</AdminTableCell>
                      <AdminTableCell>
                        <p className="truncate text-compact font-medium text-foreground">
                          {formatSourceType(entry.row.source_type)}
                        </p>
                        {entry.row.note ? (
                          <p className="truncate text-caption text-muted-foreground">{entry.row.note}</p>
                        ) : null}
                      </AdminTableCell>
                      {showOwnerColumn ? (
                        <AdminTableCell className="text-compact">{entry.row.owner_display_name}</AdminTableCell>
                      ) : null}
                      <AdminTableCell className="tabular-nums font-medium">
                        {formatInr(entry.row.amount_inr)}
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">Recorded</AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {entry.row.contributed_at ? formatTimestampDetail(entry.row.contributed_at) : "—"}
                      </AdminTableCell>
                    </AdminTableRow>
                  ),
                )}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>
        </TabsContent>

        <TabsContent value="plan" className="mt-0">
          <AdminUserGoalPlanPanel
            goal={goal}
            funding={{
              declared: funding.declared,
              contributed: funding.contributed,
              remaining: funding.remaining,
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-3">
          <div className="admin-user-family-group-detail__table-toolbar">
            <AdminSearchInput
              containerClassName="admin-user-family-group-detail__table-search"
              placeholder="Search history"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
            <AdminSelect
              value={historyEventFilter}
              onValueChange={setHistoryEventFilter}
              options={historyEventOptions}
              aria-label="Filter by event type"
              triggerClassName="admin-user-family-group-detail__table-filter"
            />
          </div>

          <AdminDataTable
            minWidth="lg"
            footer={
              <AdminTablePagination
                page={historyPagination.page}
                totalPages={historyPagination.totalPages}
                hasPrevious={historyPagination.hasPrevious}
                hasNext={historyPagination.hasNext}
                totalCount={filteredHistoryRows.length}
                currentPageCount={historyPagination.items.length}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPrevious={() => setHistoryPage((page) => Math.max(0, page - 1))}
                onNext={() => setHistoryPage((page) => page + 1)}
              />
            }
          >
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHeadCell>Event</AdminTableHeadCell>
                <AdminTableHeadCell>Details</AdminTableHeadCell>
                <AdminTableHeadCell>When</AdminTableHeadCell>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              <AdminTableRows
                colSpan={3}
                isEmpty={filteredHistoryRows.length === 0}
                emptyMessage={
                  historyRows.length === 0
                    ? "No history recorded for this goal yet."
                    : "No history entries match your search or filters."
                }
              >
                {historyPagination.items.map((row) => (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell>
                      <span className="text-compact font-medium text-foreground">{row.eventLabel}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <p className="text-compact text-foreground">{row.details}</p>
                    </AdminTableCell>
                    <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                      {row.when ? formatTimestampDetail(row.when) : "—"}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableRows>
            </AdminTableBody>
          </AdminDataTable>

          {historyRows.length === 0 && goal.family_group_id ? (
            <p className="flex items-center gap-2 text-caption text-muted-foreground">
              <ScrollText className="size-3.5 shrink-0" />
              Family group activity for this goal will appear here when the group records goal events.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
