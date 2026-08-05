"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, PauseCircle, Wallet } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorSystematicPlan, SystematicPlanStatus } from "@/lib/dummy/types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { planStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const STATUS_OPTIONS: Array<{ value: SystematicPlanStatus; label: string }> = [
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Cancelled", label: "Cancelled" },
];

type FrequencyFilter = DistributorSystematicPlan["frequency"] | "all";

const FREQUENCY_OPTIONS: Array<{ value: FrequencyFilter; label: string }> = [
  { value: "Monthly", label: "Monthly" },
  { value: "Weekly", label: "Weekly" },
  { value: "Quarterly", label: "Quarterly" },
];

type BranchDistributorSipsPanelProps = {
  profile: BranchDistributorProfile;
  plans: DistributorSystematicPlan[];
  className?: string;
};

function sipPlansOnly(plans: DistributorSystematicPlan[]): DistributorSystematicPlan[] {
  return plans.filter((plan) => plan.planType === "SIP");
}

export function BranchDistributorSipsPanel({
  profile,
  plans,
  className,
}: BranchDistributorSipsPanelProps) {
  const sipPlans = useMemo(() => sipPlansOnly(plans), [plans]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SystematicPlanStatus | "all">("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "nextDueAt",
    direction: "ascending",
  });

  const activeCount = useMemo(
    () => sipPlans.filter((plan) => plan.status === "Active").length,
    [sipPlans],
  );
  const pausedCount = useMemo(
    () => sipPlans.filter((plan) => plan.status === "Paused").length,
    [sipPlans],
  );
  const cancelledCount = useMemo(
    () => sipPlans.filter((plan) => plan.status === "Cancelled").length,
    [sipPlans],
  );
  const sipVolume = useMemo(
    () => sipPlans.reduce((sum, plan) => sum + plan.amount, 0),
    [sipPlans],
  );

  const filtered = useMemo(() => {
    return sipPlans.filter((plan) => {
      if (statusFilter !== "all" && plan.status !== statusFilter) return false;
      if (frequencyFilter !== "all" && plan.frequency !== frequencyFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        plan.planRef,
        plan.clientCode,
        plan.investorEmailMasked,
        plan.schemeName,
        plan.planType,
        plan.frequency,
      );
    });
  }, [frequencyFilter, searchQuery, sipPlans, statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled =
    statusFilter === "all" && frequencyFilter === "all" && searchQuery.trim() === "";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setFrequencyFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search SIPs…"
          aria-label="Search SIPs"
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
        label="Frequency"
        value={frequencyFilter}
        options={FREQUENCY_OPTIONS}
        onValueChange={(value) => {
          setFrequencyFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={ZYND_MITRA_COPY.mitraSipsAria}
      className="min-w-[var(--table-min-width-4xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="planRef" label="Plan" isRowHeader allowsSorting />
        <Table.Head id="clientCode" label="Client" allowsSorting />
        <Table.Head id="schemeName" label="Scheme" allowsSorting />
        <Table.Head id="frequency" label="Frequency" allowsSorting />
        <Table.Head
          id="amount"
          label="Amount"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head
          id="nextDueAt"
          label="Next due"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(plan) => (
          <Table.Row id={plan.id}>
            <Table.Cell>
              <p className="font-mono text-caption font-medium">{plan.planRef}</p>
            </Table.Cell>
            <Table.Cell className="font-mono text-caption">{plan.clientCode}</Table.Cell>
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

  return (
    <div className={cn("distributor-branch-distributor-sips-panel flex flex-col gap-4", className)}>
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={CalendarClock}
          label="SIPs"
          value={String(profile.activeSipCount)}
          hint={`${sipPlans.length} in demo sample`}
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={CheckCircle2}
          label="Active"
          value={String(activeCount)}
          hint="Currently running"
          tone="soft"
        />
        <BranchDistributorSquareMetricCard
          icon={PauseCircle}
          label="Paused"
          value={String(pausedCount)}
          hint={
            cancelledCount === 1 ? "1 cancelled in sample" : `${cancelledCount} cancelled in sample`
          }
        />
        <BranchDistributorSquareMetricCard
          icon={Wallet}
          label="Sample instalments"
          value={formatAum(sipVolume)}
          hint="Monthly SIP total in sample"
        />
      </BranchDistributorSquareCardGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No SIPs match your filters"
        emptyDescription="Adjust filters, search, or clear all to reset."
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
