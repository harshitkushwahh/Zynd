"use client";

import {
  Building2,
  IndianRupee,
  Network,
  TrendingUp,
  Users2,
} from "lucide-react";

import { DistributorHeadStatusBadge } from "@/components/distributor-head/distributor-head-badge";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { DistributorHeadHierarchyChart } from "@/components/distributor-head/distributor-head-hierarchy-chart";
import { DistributorHeadLeaveInboxCard } from "@/components/distributor-head/distributor-head-leave-inbox-card";
import { DistributorHeadStateTotalsCard } from "@/components/distributor-head/distributor-head-state-totals-card";
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
} from "@/components/ui/admin-table";
import {
  DUMMY_BRANCHES,
  DUMMY_DISTRIBUTORS,
  DUMMY_MANAGERS,
  DUMMY_SALES_ROWS,
  DUMMY_STATE_HEAD,
  sumManagersSalesMtd,
} from "@/lib/dummy/distributor-head-data";
import {
  formatDistributorHeadCount,
  formatDistributorHeadInr,
} from "@/lib/distributor-head-format";

export function DistributorHeadOverviewPanel() {
  const stateSalesMtd = sumManagersSalesMtd();
  const totalDistributors = DUMMY_DISTRIBUTORS.length;
  const activeDistributors = DUMMY_DISTRIBUTORS.filter((row) => row.status === "Active").length;

  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={Users2}
          label="Managers"
          value={String(DUMMY_MANAGERS.length)}
          hint="Reporting to this state head"
          tone="info"
        />
        <AdminMetricCard
          icon={Network}
          label="Distributors"
          value={`${activeDistributors} / ${totalDistributors}`}
          hint="Active of total in state"
        />
        <AdminMetricCard
          icon={Building2}
          label="Branches"
          value={String(DUMMY_BRANCHES.length)}
          hint="Across Maharashtra cities"
        />
        <AdminMetricCard
          icon={IndianRupee}
          label="State sales (MTD)"
          value={formatDistributorHeadInr(stateSalesMtd)}
          hint="Demo aggregate from managers"
          tone="success"
        />
      </AdminMetricCardsGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-semibold">Hierarchy journey</CardTitle>
            <p className="text-caption text-muted-foreground">
              State head → branch managers → distributor network
            </p>
          </CardHeader>
          <CardContent className="pt-5">
            <DistributorHeadHierarchyChart />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-1">
          <DistributorHeadStateTotalsCard />
          <DistributorHeadLeaveInboxCard />
        </div>
      </div>
    </div>
  );
}

export function DistributorHeadBranchesPanel() {
  return (
    <div className="space-y-4">
      <AdminSectionTitle description="Branch-level footprint and sales under this state.">
        Branches in {DUMMY_STATE_HEAD.state}
      </AdminSectionTitle>
      <AdminDataTable minWidth="6xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Branch</AdminTableHeadCell>
            <AdminTableHeadCell>City</AdminTableHeadCell>
            <AdminTableHeadCell>Manager</AdminTableHeadCell>
            <AdminTableHeadCell>Distributors</AdminTableHeadCell>
            <AdminTableHeadCell>Active clients</AdminTableHeadCell>
            <AdminTableHeadCell>AUM</AdminTableHeadCell>
            <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {DUMMY_BRANCHES.map((row) => (
            <AdminTableRow key={row.id}>
              <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
              <AdminTableCell>{row.city}</AdminTableCell>
              <AdminTableCell>{row.managerName}</AdminTableCell>
              <AdminTableCell>{row.distributorCount}</AdminTableCell>
              <AdminTableCell>{formatDistributorHeadCount(row.activeClients)}</AdminTableCell>
              <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.aumInr)}</AdminTableCell>
              <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.salesMtdInr)}</AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}

export function DistributorHeadSalesPanel() {
  const managerSalesTotal = sumManagersSalesMtd();

  return (
    <div className="space-y-6">
      <AdminMetricCardsGrid>
        <AdminMetricCard
          icon={TrendingUp}
          label="State sales MTD"
          value={formatDistributorHeadInr(managerSalesTotal)}
          hint="Sum of manager MTD (demo)"
          tone="success"
        />
        <AdminMetricCard
          icon={IndianRupee}
          label="SIP share (Jul MTD)"
          value="38%"
          hint="Demo ratio from latest row"
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
        <AdminSectionTitle description="Compare manager contribution to state MTD sales.">
          Sales by manager (MTD)
        </AdminSectionTitle>
        <AdminDataTable>
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Manager</AdminTableHeadCell>
              <AdminTableHeadCell>City</AdminTableHeadCell>
              <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
              <AdminTableHeadCell>Share of state</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            {DUMMY_MANAGERS.map((row) => {
              const share = managerSalesTotal > 0 ? (row.salesMtdInr / managerSalesTotal) * 100 : 0;
              return (
                <AdminTableRow key={row.id}>
                  <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                  <AdminTableCell>{row.city}</AdminTableCell>
                  <AdminTableCell className="tabular-nums">{formatDistributorHeadInr(row.salesMtdInr)}</AdminTableCell>
                  <AdminTableCell className="tabular-nums">{share.toFixed(1)}%</AdminTableCell>
                </AdminTableRow>
              );
            })}
          </AdminTableBody>
        </AdminDataTable>
      </div>
    </div>
  );
}
