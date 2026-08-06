"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  IndianRupee,
  Loader2,
  Network,
  Plus,
  TrendingUp,
  Users2,
} from "lucide-react";

import { DistributorHeadAddBranchDialog } from "@/components/distributor-head/distributor-head-add-branch-dialog";
import { DistributorHeadHierarchyChart } from "@/components/distributor-head/distributor-head-hierarchy-chart";
import { DistributorHeadStateTotalsCard } from "@/components/distributor-head/distributor-head-state-totals-card";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION,
} from "@/lib/admin-distributor-head-navigation";
import {
  fetchAdminHierarchyBranches,
  fetchAdminHierarchyManagers,
  fetchAdminHierarchyOverview,
  fetchAdminHierarchyPartners,
  type AdminHierarchyBranch,
  type AdminHierarchyManager,
  type AdminHierarchyOverview,
  type AdminHierarchyPartner,
} from "@/lib/admin-distributor-hierarchy-api";
import { DUMMY_SALES_ROWS } from "@/lib/dummy/distributor-head-data";
import { matchesHierarchyBranchSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import {
  formatDistributorHeadCount,
  formatDistributorHeadInr,
} from "@/lib/distributor-head-format";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";

export function DistributorHeadOverviewPanel() {
  const { displayName, user } = useAdminAuth();
  const [overview, setOverview] = useState<AdminHierarchyOverview | null>(null);
  const [managers, setManagers] = useState<AdminHierarchyManager[]>([]);
  const [partners, setPartners] = useState<AdminHierarchyPartner[]>([]);
  const [branches, setBranches] = useState<AdminHierarchyBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, managersResult, partnersResult, branchesResult] =
        await Promise.allSettled([
          fetchAdminHierarchyOverview(),
          fetchAdminHierarchyManagers(),
          fetchAdminHierarchyPartners(),
          fetchAdminHierarchyBranches(),
        ]);

      setOverview(overviewResult.status === "fulfilled" ? overviewResult.value : null);
      setManagers(managersResult.status === "fulfilled" ? managersResult.value : []);
      setPartners(partnersResult.status === "fulfilled" ? partnersResult.value : []);
      setBranches(branchesResult.status === "fulfilled" ? branchesResult.value : []);

      const failures = [overviewResult, managersResult, partnersResult, branchesResult].filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const blockingFailures = failures.filter(
        (result) => !isIgnorableListLoadError(result.reason),
      );
      if (blockingFailures.length === failures.length && failures.length > 0) {
        setError(
          getErrorMessage(
            blockingFailures[0]?.reason,
            "Could not load hierarchy overview.",
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading overview</span>
      </div>
    );
  }

  const overviewData = overview ?? {
    state_code: "MH",
    state_name: "Maharashtra",
    manager_count: managers.length,
    partner_count: partners.length,
    active_partner_count: partners.filter((row) => row.status === "Active").length,
    branch_count: branches.length,
    pending_review_count: 0,
    sales_mtd_inr: 0,
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={Users2}
          label={MITRA_HIERARCHY_COPY.branchManagers}
          value={String(overviewData.manager_count)}
          hint={`Reporting to this ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}`}
          tone="info"
        />
        <AdminMetricCard
          icon={Network}
          label={MITRA_HIERARCHY_COPY.zyndMitras}
          value={`${overviewData.active_partner_count} / ${overviewData.partner_count}`}
          hint="Active of total in state"
        />
        <AdminMetricCard
          icon={Building2}
          label="Branches"
          value={String(overviewData.branch_count)}
          hint={`${overviewData.state_name} network`}
        />
        <AdminMetricCard
          icon={IndianRupee}
          label="State sales (MTD)"
          value={formatDistributorHeadInr(overviewData.sales_mtd_inr)}
          tone="success"
        />
      </AdminMetricCardsGrid>

      <div className="distributor-head-overview-grid grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <Card className="distributor-head-overview-card min-w-0 border border-border shadow-none ring-0 lg:col-span-2">
          <CardHeader className="border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
            <CardTitle className="text-base font-semibold">{MITRA_HIERARCHY_COPY.hierarchyJourneyTitle}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-5">
            <DistributorHeadHierarchyChart
              overview={overviewData}
              managers={managers}
              partners={partners}
              stateHeadName={displayName || undefined}
              stateHeadEmail={user?.email}
            />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-1">
          <DistributorHeadStateTotalsCard overview={overviewData} branches={branches} />
        </div>
      </div>
    </div>
  );
}

export function DistributorHeadBranchesPanel() {
  const { hasPermission } = useAdminAuth();
  const canManageBranches = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);
  const [items, setItems] = useState<AdminHierarchyBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await fetchAdminHierarchyBranches();
      setItems(nextItems);
    } catch (err) {
      setItems([]);
      if (!isIgnorableListLoadError(err)) {
        setError(getErrorMessage(err, "Could not load branches."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((row) => matchesHierarchyBranchSearch(row, search)),
    [items, search],
  );

  const emptyMessage = search.trim()
    ? "No branches match your search."
    : "No branches in this state.";

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search branches by name, city, or manager"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {canManageBranches ? (
          <Button type="button" size="sm" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add branch
          </Button>
        ) : null}
      </div>

      <AdminDataTable minWidth="6xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>City</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Active clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableStateRow colSpan={7}>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading branches…
              </span>
            </AdminTableStateRow>
          ) : filtered.length === 0 ? (
            <AdminTableStateRow colSpan={7}>{emptyMessage}</AdminTableStateRow>
          ) : (
            filtered.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.city || "—"}</AdminTableCell>
                <AdminTableCell>{row.manager_name}</AdminTableCell>
                <AdminTableCell>{row.partner_count}</AdminTableCell>
                <AdminTableCell>{formatDistributorHeadCount(row.active_clients)}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.aum_inr)}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.sales_mtd_inr)}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <DistributorHeadAddBranchDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void load()}
      />
    </div>
  );
}

export function DistributorHeadSalesPanel() {
  const [managers, setManagers] = useState<AdminHierarchyManager[]>([]);
  const [overview, setOverview] = useState<AdminHierarchyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextManagers, nextOverview] = await Promise.all([
        fetchAdminHierarchyManagers(),
        fetchAdminHierarchyOverview(),
      ]);
      setManagers(nextManagers);
      setOverview(nextOverview);
    } catch (err) {
      setManagers([]);
      setOverview(null);
      if (!isIgnorableListLoadError(err)) {
        setError(getErrorMessage(err, "Could not load sales summary."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const managerSalesTotal = useMemo(
    () => managers.reduce((sum, row) => sum + row.sales_mtd_inr, 0),
    [managers],
  );

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading sales</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={TrendingUp}
          label="State sales MTD"
          value={formatDistributorHeadInr(overview?.sales_mtd_inr ?? managerSalesTotal)}
          tone="success"
        />
        <AdminMetricCard
          icon={IndianRupee}
          label="SIP share (Jul MTD)"
          value="—"
          tone="info"
        />
      </AdminMetricCardsGrid>

      <div className="space-y-4">
        <AdminSectionTitle description="Monthly lumpsum and SIP inflow across the state network.">
          Sales by period
        </AdminSectionTitle>
        <AdminDataTable>
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Period</AdminTableHeadCell>
              <AdminTableHeadCell>Lumpsum</AdminTableHeadCell>
              <AdminTableHeadCell>SIP</AdminTableHeadCell>
              <AdminTableHeadCell>Total</AdminTableHeadCell>
              <AdminTableHeadCell>Transactions</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {DUMMY_SALES_ROWS.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">{row.periodLabel}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.lumpsumInr)}</AdminTableCell>
                <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.sipInr)}</AdminTableCell>
                <AdminTableCell className="tabular-nums font-medium">
                  {formatDistributorHeadInr(row.totalInr)}
                </AdminTableCell>
                <AdminTableCell>{formatDistributorHeadCount(row.transactionCount)}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      </div>

      <div className="space-y-4">
        <AdminSectionTitle description={`Compare ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} contribution to state MTD sales.`}>
          Sales by {MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} (MTD)
        </AdminSectionTitle>
        <AdminDataTable>
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManager}</AdminTableHeadCell>
              <AdminTableHeadCell>City</AdminTableHeadCell>
              <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
              <AdminTableHeadCell>Share of state</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {managers.length === 0 ? (
              <AdminTableStateRow colSpan={4}>
                No {MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} in this state yet.
              </AdminTableStateRow>
            ) : (
              managers.map((row) => {
                const share =
                  managerSalesTotal > 0 ? (row.sales_mtd_inr / managerSalesTotal) * 100 : 0;
                return (
                  <AdminTableRow key={row.id}>
                    <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                    <AdminTableCell>{row.city || "—"}</AdminTableCell>
                    <AdminTableCell className="tabular-nums">
                      {formatDistributorHeadInr(row.sales_mtd_inr)}
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{share.toFixed(1)}%</AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminDataTable>
      </div>
    </div>
  );
}
