"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { useDistributorTablePagination, Table } from "@/components/application/table";
import {
  applyInvestorTableFilters,
  DEFAULT_INVESTOR_TABLE_FILTERS,
  investorFiltersAreDefault,
  type InvestorTableFilters,
} from "@/components/investors/investor-filters";
import { InvestorTableToolbar } from "@/components/investors/investor-table-toolbar";
import {
  AssignDistributorCell,
  AssignDistributorDialog,
} from "@/components/investors/assign-distributor-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useResidentDistributorAssignment } from "@/contexts/resident-distributor-assignment-context";
import { distributorClientDetailHrefForInvestor } from "@/lib/distributor-client-routes";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import type { DistributorInvestor, InvestorType } from "@/lib/distributor-types";
import {
  filterDistributorBookInvestors,
  filterInvestorsByType,
  filterSystemResidentInvestors,
} from "@/lib/distributor-investor-utils";
import { fetchDistributorClients } from "@/lib/distributor-clients-api";
import { formatDistributorDate } from "@/lib/format";
import {
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS,
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_WIDE_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import {
  complianceStatusVariant,
  investmentStatusVariant,
  onboardingStatusVariant,
} from "@/lib/status-meta";
import { cn } from "@/lib/utils";

type InvestorsPanelProps = DistributorPageConfig & {
  investorType?: InvestorType;
  layout?: "page" | "table";
  investorScope: "distributor-book" | "system-residents";
  listOrigin: DistributorClientListOrigin;
  showServiceModel?: boolean;
  showServiceModelFilter?: boolean;
};

export function InvestorsPanel({
  iconName,
  title,
  description,
  investorType,
  layout = "page",
  investorScope,
  listOrigin,
  showServiceModel = false,
  showServiceModelFilter = false,
}: InvestorsPanelProps) {
  const router = useRouter();
  const { isBranchManager, canManageBranchBook } = useDistributorAuth();
  const showManagerAssignment =
    isBranchManager &&
    canManageBranchBook &&
    investorScope === "system-residents" &&
    listOrigin === "system-resident";
  const { assignments } = useResidentDistributorAssignment();
  const [assignInvestor, setAssignInvestor] = useState<DistributorInvestor | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [filters, setFilters] = useState<InvestorTableFilters>(DEFAULT_INVESTOR_TABLE_FILTERS);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [apiInvestors, setApiInvestors] = useState<DistributorInvestor[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scope = investorScope === "distributor-book" ? "book" : "platform";
    void fetchDistributorClients({ limit: 100, scope })
      .then((items) => {
        if (!cancelled) {
          setApiInvestors(items);
          setApiError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setApiInvestors([]);
          setApiError(error instanceof Error ? error.message : "Could not load clients.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [investorScope]);

  const sourceInvestors = apiInvestors ?? [];

  const scoped = useMemo(() => {
    let rows = sourceInvestors;
    if (investorScope === "distributor-book") {
      rows = filterDistributorBookInvestors(rows);
    } else {
      rows = filterSystemResidentInvestors(rows);
    }
    return filterInvestorsByType(rows, investorType);
  }, [sourceInvestors, investorScope, investorType]);

  const filtered = useMemo(
    () => applyInvestorTableFilters(scoped, filters),
    [scoped, filters],
  );

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const openClientDetail = (investor: DistributorInvestor) => {
    router.push(distributorClientDetailHrefForInvestor(listOrigin, investor));
  };

  const onboardedCount = scoped.filter((i) => i.onboardingStatus === "Onboarded").length;
  const pendingOnboardingCount = scoped.length - onboardedCount;
  const investedCount = scoped.filter((i) => i.investmentStatus === "Invested").length;
  const compliantCount = scoped.filter((i) => i.complianceStatus === "Compliant").length;
  const nonCompliantCount = scoped.length - compliantCount;

  const clearDisabled = investorFiltersAreDefault(filters);
  const isLoadingApi = apiInvestors === null;
  const isBookEmpty = !isLoadingApi && !apiError && scoped.length === 0;
  const clientCodeColumnClass = showServiceModel
    ? DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_WIDE_CLASS
    : DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS;

  const emptyTitle = apiError
    ? "Could not load clients"
    : isBookEmpty
      ? "No clients added"
      : "No clients match your filters";

  const emptyDescription = apiError
    ? apiError
    : isBookEmpty
      ? "Clients you onboard will appear in this list."
      : "Adjust filters or clear all to reset the list.";

  const handleClearAll = () => {
    setFilters(DEFAULT_INVESTOR_TABLE_FILTERS);
    setPage(1);
  };

  const toolbar = (
    <InvestorTableToolbar
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        setPage(1);
      }}
      onClearAll={handleClearAll}
      clearDisabled={clearDisabled}
      showTypeFilter={!investorType}
      showServiceModelFilter={showServiceModelFilter}
    />
  );

  const openAssignDialog = (investor: DistributorInvestor) => {
    setAssignInvestor(investor);
    setAssignDialogOpen(true);
  };

  const table = wrapDistributorTableBody(
    <>
    <Table
      aria-label="Investors"
      className={cn(
        "min-w-[var(--table-min-width-5xl)]",
        showManagerAssignment && "min-w-[var(--table-min-width-6xl)]",
      )}
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="emailMasked" label="Email" allowsSorting />
        <Table.Head
          id="clientCode"
          label="Client code"
          isRowHeader
          allowsSorting
          className={clientCodeColumnClass}
        />
        <Table.Head id="mobileMasked" label="Mobile" allowsSorting />
        <Table.Head id="onboardingStatus" label="Onboarding" allowsSorting />
        <Table.Head id="complianceStatus" label="Compliance" allowsSorting />
        <Table.Head id="investmentStatus" label="Investment" allowsSorting />
        {showServiceModel ? (
          <Table.Head id="serviceModel" label="Channel" allowsSorting />
        ) : null}
        {showManagerAssignment ? (
          <Table.Head id="distributorAssign" label={ZYND_MITRA_COPY.singular} />
        ) : null}
        <Table.Head id="investorType" label="Type" allowsSorting />
        <Table.Head
          id="createdAt"
          label="Created"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(investor) => (
          <Table.Row
            id={investor.id}
            className="cursor-pointer"
            onAction={() => openClientDetail(investor)}
          >
            <Table.Cell className="font-medium">{investor.emailMasked}</Table.Cell>
            <Table.Cell className={cn("font-mono text-caption", clientCodeColumnClass)}>
              {investor.clientCode}
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{investor.mobileMasked}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                {investor.onboardingStatus}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={complianceStatusVariant(investor.complianceStatus)}>
                {investor.complianceStatus}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                {investor.investmentStatus}
              </StatusBadge>
            </Table.Cell>
            {showServiceModel ? (
              <Table.Cell>
                <StatusBadge variant="neutral">
                  {investor.serviceModel === "pm" ? "PM" : "DIY"}
                </StatusBadge>
              </Table.Cell>
            ) : null}
            {showManagerAssignment ? (
              <Table.Cell>
                <AssignDistributorCell
                  investor={investor}
                  onAssign={() => openAssignDialog(investor)}
                />
              </Table.Cell>
            ) : null}
            <Table.Cell className="text-muted-foreground">{investor.investorType}</Table.Cell>
            <Table.Cell
              className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
            >
              {formatDistributorDate(investor.createdAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
    {showManagerAssignment ? (
      <AssignDistributorDialog
        investor={assignInvestor}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
      />
    ) : null}
    </>,
  );

  if (layout === "table") {
    return (
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={!isLoadingApi && sorted.length === 0}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    );
  }

  return (
    <DistributorPageShell
        title={title}
        description={description}
        isEmpty={!isLoadingApi && sorted.length === 0}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        metrics={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DistributorMetricCard
              icon={Users}
              label="Total investors"
              value={String(scoped.length)}
              hint="In this list"
            />
            <DistributorMetricCard
              icon={UserPlus}
              label="Onboarded"
              value={String(onboardedCount)}
              hint={
                pendingOnboardingCount === 1
                  ? "1 pending onboarding"
                  : `${pendingOnboardingCount} pending onboarding`
              }
            />
            <DistributorMetricCard
              icon={UserCheck}
              label="Invested"
              value={String(investedCount)}
              hint={
                scoped.length - investedCount === 1
                  ? "1 not invested yet"
                  : `${scoped.length - investedCount} not invested yet`
              }
            />
            <DistributorMetricCard
              icon={ShieldCheck}
              label="Compliant"
              value={String(compliantCount)}
              hint={
                nonCompliantCount === 1 ? "1 needs attention" : `${nonCompliantCount} need attention`
              }
            />
          </div>
        }
        toolbar={toolbar}
      >
        {table}
    </DistributorPageShell>
  );
}
