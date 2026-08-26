"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  getScopedTxnRequests,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorTxnRequest, TxnRequestStatus } from "@/lib/distributor-types";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { txnRequestStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: TxnRequestStatus; label: string }> = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

type RequestTypeFilter = DistributorTxnRequest["requestType"] | "all";

const REQUEST_TYPE_OPTIONS: Array<{ value: RequestTypeFilter; label: string }> = [
  { value: "Purchase", label: "Purchase" },
  { value: "Redeem", label: "Redeem" },
  { value: "SIP Register", label: "SIP Register" },
  { value: "Folio Update", label: "Folio Update" },
];

type TxnRequestsPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
  operationsListScope?: DistributorOrdersListScope;
};

export function TxnRequestsPanel({
  title,
  description,
  layout = "page",
  operationsListScope = "your-book",
}: TxnRequestsPanelProps) {
  const { requests: allRequests } = useDistributorTxnRequests();
  const requests = useMemo(
    () => getScopedTxnRequests(allRequests, operationsListScope),
    [allRequests, operationsListScope],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TxnRequestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (typeFilter !== "all" && request.requestType !== typeFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        request.requestRef,
        request.clientCode,
        request.investorEmailMasked,
        request.requestType,
      );
    });
  }, [requests, searchQuery, statusFilter, typeFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const rejectedCount = requests.filter((r) => r.status === "Rejected").length;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={
        statusFilter === "all" && typeFilter === "all" && searchQuery.trim() === ""
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search requests…"
          aria-label="Search txn requests"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Request type"
        value={typeFilter}
        options={REQUEST_TYPE_OPTIONS}
        onValueChange={(value) => {
          setTypeFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
        aria-label="Txn requests"
        className="min-w-[var(--table-min-width-3xl)]"
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor);
          setPage(1);
        }}
        pagination={pagination}
      >
        <Table.Header>
          <Table.Head id="requestRef" label="Request" isRowHeader allowsSorting />
          <Table.Head id="investorEmailMasked" label="Investor" allowsSorting />
          <Table.Head id="requestType" label="Type" allowsSorting />
          <Table.Head
            id="amount"
            label="Amount"
            allowsSorting
            className="text-right [&>div]:justify-end"
          />
          <Table.Head id="status" label="Status" allowsSorting />
          <Table.Head
            id="createdAt"
            label="Created"
            allowsSorting
            className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
          />
        </Table.Header>
        <Table.Body items={pageItems}>
          {(request) => (
            <Table.Row id={request.id}>
              <Table.Cell>
                <p className="font-mono text-caption font-medium">{request.requestRef}</p>
                <p className="text-caption text-muted-foreground">{request.clientCode}</p>
              </Table.Cell>
              <Table.Cell className="text-muted-foreground">{request.investorEmailMasked}</Table.Cell>
              <Table.Cell>{request.requestType}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">{formatAum(request.amount)}</Table.Cell>
              <Table.Cell>
                <StatusBadge variant={txnRequestStatusVariant(request.status)}>
                  {request.status}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell
                className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
              >
                {formatDistributorDate(request.createdAt)}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
    </Table>,
  );

  if (layout === "table") {
    return (
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No txn requests match your filters"
        emptyDescription="Adjust filters, search, or clear all to reset."
      >
        {table}
      </DistributorTableOnlyShell>
    );
  }

  return (
    <DistributorPageShell
      title={title}
      description={description}
      isEmpty={sorted.length === 0}
      emptyTitle="No txn requests match your filters"
      emptyDescription="Adjust filters, search, or clear all to reset."
      metrics={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DistributorMetricCard
            icon={ArrowLeftRight}
            label="Total requests"
            value={String(requests.length)}
            hint="In demo queue"
          />
          <DistributorMetricCard
            icon={Clock3}
            label="Pending"
            value={String(pendingCount)}
            hint="Awaiting action"
          />
          <DistributorMetricCard
            icon={CheckCircle2}
            label="Approved"
            value={String(approvedCount)}
            hint="Processed"
          />
          <DistributorMetricCard
            icon={XCircle}
            label="Rejected"
            value={String(rejectedCount)}
            hint="Declined"
          />
        </div>
      }
      toolbar={toolbar}
    >
      {table}
    </DistributorPageShell>
  );
}
