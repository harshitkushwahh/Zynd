"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { ClientActivityMetricsTiles } from "@/components/clients/client-activity-metrics-tiles";
import { ClientActivitySubTabSkeleton } from "@/components/clients/client-activity-sub-tab-skeleton";
import { ClientActivitySubTabs } from "@/components/clients/client-activity-sub-tabs";
import { useClientActivitySubTabSwitch } from "@/components/clients/use-client-activity-sub-tab-switch";
import { useClientPageReveal } from "@/components/clients/use-client-page-reveal";
import { ClientOrderDetailDialog } from "@/components/clients/client-order-detail-dialog";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  buildClientOrdersForInvestor,
  buildClientSipsForInvestor,
} from "@/lib/distributor-client-profile-data";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorInvestor, DistributorOrder, DistributorSystematicPlan, OrderStatus, SystematicPlanStatus } from "@/lib/distributor-types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { orderStatusVariant, planStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const SIP_STATUS_OPTIONS: Array<{ value: SystematicPlanStatus; label: string }> = [
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Cancelled", label: "Cancelled" },
];

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "Pending", label: "Pending" },
  { value: "Processing", label: "Processing" },
  { value: "Completed", label: "Completed" },
  { value: "Failed", label: "Failed" },
];

type OrderTypeFilter = DistributorOrder["orderType"] | "all";

const ORDER_TYPE_OPTIONS: Array<{ value: OrderTypeFilter; label: string }> = [
  { value: "Purchase", label: "Purchase" },
  { value: "Redeem", label: "Redeem" },
  { value: "Switch", label: "Switch" },
];

type ClientSipsTransactionsTabPanelProps = {
  investor: DistributorInvestor;
  ordersOverride?: DistributorOrder[];
  systematicPlansOverride?: DistributorSystematicPlan[];
};

function resolveClientSips(
  investor: DistributorInvestor,
  override?: DistributorSystematicPlan[],
): DistributorSystematicPlan[] {
  if (override !== undefined) {
    return override.filter((plan) => plan.planType === "SIP");
  }
  return buildClientSipsForInvestor(investor);
}

function resolveClientOrders(
  investor: DistributorInvestor,
  override?: DistributorOrder[],
): DistributorOrder[] {
  if (override !== undefined) return override;
  return buildClientOrdersForInvestor(investor);
}

export function ClientSipsTransactionsTabPanel({
  investor,
  ordersOverride,
  systematicPlansOverride,
}: ClientSipsTransactionsTabPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.activity;

  const sourceSips = useMemo(
    () => resolveClientSips(investor, systematicPlansOverride),
    [investor, systematicPlansOverride],
  );
  const sourceOrders = useMemo(
    () => resolveClientOrders(investor, ordersOverride),
    [investor, ordersOverride],
  );

  const [sipSearch, setSipSearch] = useState("");
  const [sipStatusFilter, setSipStatusFilter] = useState<SystematicPlanStatus | "all">("all");
  const [sipSort, setSipSort] = useState<SortDescriptor>({
    column: "nextDueAt",
    direction: "ascending",
  });

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | "all">("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>("all");
  const [orderSort, setOrderSort] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [selectedOrder, setSelectedOrder] = useState<DistributorOrder | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const { activeSubTab, setActiveSubTab, isSwitching, showPanelSkeleton } =
    useClientActivitySubTabSwitch();
  const { showSkeleton: showInitialReveal } = useClientPageReveal({
    ready: true,
    resetKey: investor.id,
  });
  const showActivitySkeleton = showPanelSkeleton || showInitialReveal;

  const activeSubTabTitle =
    activeSubTab === "sips" ? copy.sipsSectionTitle : copy.transactionsSectionTitle;

  const filteredSips = useMemo(() => {
    return sourceSips.filter((plan) => {
      if (sipStatusFilter !== "all" && plan.status !== sipStatusFilter) return false;
      return distributorTableSearchMatch(
        sipSearch,
        plan.planRef,
        plan.schemeName,
        plan.frequency,
        plan.status,
      );
    });
  }, [sipSearch, sipStatusFilter, sourceSips]);

  const sortedSips = useMemo(
    () => sortByDescriptor(filteredSips, sipSort),
    [filteredSips, sipSort],
  );

  const {
    pageItems: sipPageItems,
    pagination: sipPagination,
    setPage: setSipPage,
  } = useDistributorTablePagination(sortedSips);

  const filteredOrders = useMemo(() => {
    return sourceOrders.filter((order) => {
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) return false;
      if (orderTypeFilter !== "all" && order.orderType !== orderTypeFilter) return false;
      return distributorTableSearchMatch(
        orderSearch,
        order.orderRef,
        order.schemeName,
        order.orderType,
        order.status,
      );
    });
  }, [orderSearch, orderStatusFilter, orderTypeFilter, sourceOrders]);

  const sortedOrders = useMemo(
    () => sortByDescriptor(filteredOrders, orderSort),
    [filteredOrders, orderSort],
  );

  const {
    pageItems: orderPageItems,
    pagination: orderPagination,
    setPage: setOrderPage,
  } = useDistributorTablePagination(sortedOrders);

  const openOrderDetail = (order: DistributorOrder) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
  };

  const sipToolbar = (
    <DistributorTableToolbar
      className="distributor-client-activity-tab__toolbar"
      onClearAll={() => {
        setSipSearch("");
        setSipStatusFilter("all");
        setSipPage(1);
      }}
      clearDisabled={sipStatusFilter === "all" && sipSearch.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={sipSearch}
          onChange={(value) => {
            setSipSearch(value);
            setSipPage(1);
          }}
          placeholder={copy.searchSipsPlaceholder}
          aria-label={copy.searchSipsPlaceholder}
        />
      }
    >
      <StatusFilterSelect
        label={copy.statusFilterLabel}
        value={sipStatusFilter}
        options={SIP_STATUS_OPTIONS}
        onValueChange={(value) => {
          setSipStatusFilter(value);
          setSipPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const orderToolbar = (
    <DistributorTableToolbar
      className="distributor-client-activity-tab__toolbar"
      onClearAll={() => {
        setOrderSearch("");
        setOrderStatusFilter("all");
        setOrderTypeFilter("all");
        setOrderPage(1);
      }}
      clearDisabled={
        orderStatusFilter === "all" && orderTypeFilter === "all" && orderSearch.trim() === ""
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={orderSearch}
          onChange={(value) => {
            setOrderSearch(value);
            setOrderPage(1);
          }}
          placeholder={copy.searchOrdersPlaceholder}
          aria-label={copy.searchOrdersPlaceholder}
        />
      }
    >
      <StatusFilterSelect
        label={copy.statusFilterLabel}
        value={orderStatusFilter}
        options={ORDER_STATUS_OPTIONS}
        onValueChange={(value) => {
          setOrderStatusFilter(value);
          setOrderPage(1);
        }}
      />
      <StatusFilterSelect
        label={copy.orderTypeFilterLabel}
        value={orderTypeFilter}
        options={ORDER_TYPE_OPTIONS}
        onValueChange={(value) => {
          setOrderTypeFilter(value);
          setOrderPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const sipTable = wrapDistributorTableBody(
    <Table
      key="client-activity-sips-table"
      aria-label={copy.sipsSectionTitle}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sipSort}
      onSortChange={(descriptor) => {
        setSipSort(descriptor);
        setSipPage(1);
      }}
      pagination={sipPagination}
    >
      <Table.Header>
        <Table.Head id="planRef" label={copy.sipColumnPlan} isRowHeader allowsSorting />
        <Table.Head id="schemeName" label={copy.sipColumnScheme} allowsSorting />
        <Table.Head id="frequency" label={copy.sipColumnFrequency} allowsSorting />
        <Table.Head
          id="amount"
          label={copy.sipColumnAmount}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label={copy.sipColumnStatus} allowsSorting />
        <Table.Head
          id="nextDueAt"
          label={copy.sipColumnNextDue}
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={sipPageItems}>
        {(plan) => (
          <Table.Row id={plan.id}>
            <Table.Cell className="font-mono text-caption font-medium">{plan.planRef}</Table.Cell>
            <Table.Cell>{plan.schemeName}</Table.Cell>
            <Table.Cell className="text-muted-foreground">{plan.frequency}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(plan.amount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={planStatusVariant(plan.status)}>{plan.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell
              className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
            >
              {formatDistributorDate(plan.nextDueAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  const orderTable = wrapDistributorTableBody(
    <Table
      key="client-activity-transactions-table"
      aria-label={copy.transactionsSectionTitle}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={orderSort}
      onSortChange={(descriptor) => {
        setOrderSort(descriptor);
        setOrderPage(1);
      }}
      pagination={orderPagination}
    >
      <Table.Header>
        <Table.Head id="orderRef" label={copy.orderColumnOrder} isRowHeader allowsSorting />
        <Table.Head id="schemeName" label={copy.orderColumnScheme} allowsSorting />
        <Table.Head id="orderType" label={copy.orderColumnType} allowsSorting />
        <Table.Head
          id="amount"
          label={copy.orderColumnAmount}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label={copy.orderColumnStatus} allowsSorting />
        <Table.Head
          id="createdAt"
          label={copy.orderColumnCreated}
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="details" label={copy.orderColumnDetails} />
      </Table.Header>
      <Table.Body items={orderPageItems}>
        {(order) => (
          <Table.Row id={order.id}>
            <Table.Cell className="font-mono text-caption font-medium">{order.orderRef}</Table.Cell>
            <Table.Cell>{order.schemeName}</Table.Cell>
            <Table.Cell className="text-muted-foreground">{order.orderType}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(order.amount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={orderStatusVariant(order.status)}>{order.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell
              className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
            >
              {formatDistributorDate(order.createdAt)}
            </Table.Cell>
            <Table.Cell>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-caption"
                onClick={() => openOrderDetail(order)}
              >
                {copy.orderViewDetails}
              </Button>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className="distributor-client-activity-tab">
      <DistributorPageHeader
        title={activeSubTabTitle}
        titleAs="h3"
        titleSwitchKey={activeSubTab}
        titleClassName="distributor-client-activity-tab__title text-xl font-normal"
        className="distributor-client-activity-tab__subheader"
      >
        <ClientActivitySubTabs
          value={activeSubTab}
          onChange={setActiveSubTab}
          busy={isSwitching}
        />
      </DistributorPageHeader>

      {showActivitySkeleton ? (
        <ClientActivitySubTabSkeleton />
      ) : (
        <>
          <div className="distributor-client-activity-tab__controls">
            <ClientActivityMetricsTiles
              subTab={activeSubTab}
              sips={sourceSips}
              orders={sourceOrders}
              className="distributor-client-activity-tab__metrics-row"
            />
            <div className="distributor-client-activity-tab__filters-row">
              {activeSubTab === "sips" ? sipToolbar : orderToolbar}
            </div>
          </div>

          {activeSubTab === "sips" ? (
            <div
              key="sips"
              role="tabpanel"
              id="client-activity-sub-panel-sips"
              aria-labelledby="client-activity-sub-tab-sips"
              className={cn(
                "distributor-client-activity-tab__panel distributor-client-activity-tab__panel--enter",
                isSwitching && "distributor-client-activity-tab__panel--pending",
              )}
            >
              <DistributorTableOnlyShell
                isEmpty={sortedSips.length === 0}
                emptyTitle={copy.sipsEmptyFiltered}
                emptyDescription={copy.filtersEmptyDescription}
              >
                {sipTable}
              </DistributorTableOnlyShell>
            </div>
          ) : (
            <div
              key="transactions"
              role="tabpanel"
              id="client-activity-sub-panel-transactions"
              aria-labelledby="client-activity-sub-tab-transactions"
              className={cn(
                "distributor-client-activity-tab__panel distributor-client-activity-tab__panel--enter",
                isSwitching && "distributor-client-activity-tab__panel--pending",
              )}
            >
              <DistributorTableOnlyShell
                isEmpty={sortedOrders.length === 0}
                emptyTitle={copy.transactionsEmptyFiltered}
                emptyDescription={copy.filtersEmptyDescription}
              >
                {orderTable}
              </DistributorTableOnlyShell>
            </div>
          )}
        </>
      )}

      <ClientOrderDetailDialog
        open={orderDetailOpen}
        onOpenChange={(next) => {
          setOrderDetailOpen(next);
          if (!next) setSelectedOrder(null);
        }}
        order={selectedOrder}
      />
    </div>
  );
}
