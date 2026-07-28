"use client";

import { Building2, IndianRupee, Mail, MapPin, Network, Users2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DistributorHeadChipBadge,
  DistributorHeadStatusBadge,
} from "@/components/distributor-head/distributor-head-badge";
import { DistributorHeadListToolbar } from "@/components/distributor-head/distributor-head-list-toolbar";
import { DistributorHeadManagerIncentivesCard } from "@/components/distributor-head/distributor-head-manager-incentives-card";
import { DistributorHeadManagerLeavePanel } from "@/components/distributor-head/distributor-head-manager-leave-panel";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DUMMY_STATE_HEAD,
  type DistributorHeadManager,
} from "@/lib/dummy/distributor-head-data";
import {
  distributorHeadDistributorHref,
  getBranchesForManager,
  getClientsForManager,
  getDistributorsForManager,
  getIncentiveForManager,
  getLeaveForManager,
  matchesDistributorSearch,
  matchesManagerClientSearch,
  sumDistributorClients,
} from "@/lib/distributor-head-queries";
import {
  formatDistributorHeadCount,
  formatDistributorHeadInr,
} from "@/lib/distributor-head-format";

const STATUS_ALL = "all";
const CLIENT_STATUS_ALL = "all";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

type DistributorHeadManagerDetailProps = {
  manager: DistributorHeadManager;
};

export function DistributorHeadManagerDetail({ manager }: DistributorHeadManagerDetailProps) {
  const router = useRouter();
  const branches = useMemo(() => getBranchesForManager(manager.id), [manager.id]);
  const team = useMemo(() => getDistributorsForManager(manager.id), [manager.id]);
  const clients = useMemo(() => getClientsForManager(manager.id), [manager.id]);
  const leaveItems = useMemo(() => getLeaveForManager(manager.id), [manager.id]);
  const incentive = useMemo(() => getIncentiveForManager(manager.id), [manager.id]);

  const [teamSearch, setTeamSearch] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState(STATUS_ALL);
  const [teamPage, setTeamPage] = useState(0);

  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState(CLIENT_STATUS_ALL);
  const [clientPage, setClientPage] = useState(0);
  const [bookTab, setBookTab] = useState<"distributors" | "clients">("distributors");

  const filteredTeam = useMemo(() => {
    return team.filter((row) => {
      if (!matchesDistributorSearch(row, teamSearch)) return false;
      if (teamStatusFilter !== STATUS_ALL && row.status !== teamStatusFilter) return false;
      return true;
    });
  }, [team, teamSearch, teamStatusFilter]);

  const teamPagination = useMemo(
    () => paginateItems(filteredTeam, teamPage, ADMIN_TABLE_PAGE_SIZE),
    [filteredTeam, teamPage],
  );

  const filteredClients = useMemo(() => {
    return clients.filter((row) => {
      if (!matchesManagerClientSearch(row, clientSearch)) return false;
      if (clientStatusFilter === "invested" && !row.hasInvested) return false;
      if (clientStatusFilter === "not_invested" && row.hasInvested) return false;
      if (clientStatusFilter === "kyc_pending" && row.kycCompliant) return false;
      return true;
    });
  }, [clientSearch, clientStatusFilter, clients]);

  const clientPagination = useMemo(
    () => paginateItems(filteredClients, clientPage, ADMIN_TABLE_PAGE_SIZE),
    [clientPage, filteredClients],
  );

  const activeOnTeam = team.filter((row) => row.status === "Active").length;
  const teamClientsFromDist = sumDistributorClients(team);
  const pendingLeave = leaveItems.filter((row) => row.status === "Pending").length;

  return (
    <div className="space-y-6">
      <Card className="border-border/80">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5">
          <Avatar className="size-14 shrink-0 rounded-xl">
            <AvatarFallback className="rounded-xl bg-primary/10 text-lg font-semibold text-primary">
              {initialsFromName(manager.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold text-foreground">{manager.name}</h2>
              <DistributorHeadStatusBadge status={manager.status} />
              {pendingLeave > 0 ? (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  {pendingLeave} leave pending
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <Mail className="size-3 opacity-70" />
                {manager.email}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <MapPin className="size-3 opacity-70" />
                {manager.city}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                Reports to {DUMMY_STATE_HEAD.name}
              </Badge>
              <Badge variant="outline" className="font-normal tabular-nums">
                {branches.length} branches · {team.length} distributors
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Branches"
          value={formatDistributorHeadCount(branches.length)}
          hint="Locations this manager runs"
          icon={Building2}
          tone="info"
        />
        <AdminMetricCard
          label="Distributors"
          value={formatDistributorHeadCount(team.length)}
          hint={`${activeOnTeam} active on the team`}
          icon={Network}
          tone="default"
        />
        <AdminMetricCard
          label="Investor clients"
          value={formatDistributorHeadCount(clients.length || teamClientsFromDist)}
          hint={
            clients.length > 0
              ? `${clients.filter((c) => c.hasInvested).length} invested in demo book`
              : "Across their distributor book"
          }
          icon={Users2}
          tone="success"
        />
        <AdminMetricCard
          label="Sales MTD"
          value={formatDistributorHeadInr(manager.salesMtdInr)}
          hint={`YTD ${formatDistributorHeadInr(manager.salesYtdInr)}`}
          icon={IndianRupee}
          tone="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DistributorHeadManagerIncentivesCard incentive={incentive} />
        </div>
        <div className="lg:col-span-3">
          <DistributorHeadManagerLeavePanel items={leaveItems} />
        </div>
      </div>

      <div className="space-y-3">
        <AdminSectionTitle description="Branches this manager is accountable for.">
          Branch footprint
        </AdminSectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((branch) => (
            <Card key={branch.id} className="border-border/80">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{branch.name}</p>
                    <DistributorHeadChipBadge className="text-muted-foreground">
                      {branch.city}
                    </DistributorHeadChipBadge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="tabular-nums font-normal">
                      {branch.distributorCount} distributors
                    </Badge>
                    <Badge variant="outline" className="tabular-nums font-normal">
                      {formatDistributorHeadCount(branch.activeClients)} clients
                    </Badge>
                    <Badge variant="secondary" className="tabular-nums font-normal">
                      MTD {formatDistributorHeadInr(branch.salesMtdInr)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Tabs
          value={bookTab}
          onValueChange={(value) => {
            if (value === "distributors" || value === "clients") setBookTab(value);
          }}
          className="gap-4"
        >
          <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <AdminSectionTitle variant="section" className="pb-2 sm:pb-3">
              {bookTab === "distributors" ? "Distributors" : "Manager clients"}
            </AdminSectionTitle>
            <TabsList
              variant="line"
              className="h-auto w-fit max-w-full shrink-0 justify-end overflow-x-auto overflow-y-hidden border-b-0 pb-0"
            >
              <TabsTrigger value="distributors" className="h-auto flex-none gap-2 px-4 py-2">
                Distributors
                <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                  {team.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="clients" className="h-auto flex-none gap-2 px-4 py-2">
                Manager clients
                <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                  {clients.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="distributors" className="mt-0 space-y-4">
        <DistributorHeadListToolbar
          searchPlaceholder="Search team by name, ARN, or branch"
          searchValue={teamSearch}
          onSearchChange={(value) => {
            setTeamSearch(value);
            setTeamPage(0);
          }}
          filters={
            <Select
              value={teamStatusFilter}
              onValueChange={(value) => {
                setTeamStatusFilter(value ?? STATUS_ALL);
                setTeamPage(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Onboarding">Onboarding</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <AdminDataTable minWidth="5xl">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Distributor</AdminTableHeadCell>
              <AdminTableHeadCell>Branch</AdminTableHeadCell>
              <AdminTableHeadCell>Book</AdminTableHeadCell>
              <AdminTableHeadCell>Sales MTD</AdminTableHeadCell>
              <AdminTableHeadCell>Status</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            <AdminTableRows
              colSpan={5}
              isEmpty={teamPagination.items.length === 0}
              emptyMessage="No distributors on this team match your filters."
            >
              {teamPagination.items.map((row) => (
                <AdminTableRow
                  key={row.id}
                  onClick={() => router.push(distributorHeadDistributorHref(row.id))}
                >
                  <AdminTableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-primary/10 text-caption font-medium text-primary">
                          {initialsFromName(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium">{row.name}</p>
                        <Badge variant="outline" className="mt-1 h-5 font-mono text-micro font-normal">
                          {row.arn}
                        </Badge>
                      </div>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <DistributorHeadChipBadge>{row.branchName}</DistributorHeadChipBadge>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="tabular-nums font-normal">
                        {row.clientCount} clients
                      </Badge>
                      <Badge variant="secondary" className="tabular-nums font-normal">
                        {formatDistributorHeadInr(row.aumInr)} AUM
                      </Badge>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadInr(row.salesMtdInr)}
                  </AdminTableCell>
                  <AdminTableCell>
                    <DistributorHeadStatusBadge status={row.status} />
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableRows>
          </AdminTableBody>
        </AdminDataTable>

        <AdminTablePagination
          page={teamPagination.page}
          totalPages={teamPagination.totalPages}
          hasPrevious={teamPagination.hasPrevious}
          hasNext={teamPagination.hasNext}
          onPrevious={() => setTeamPage((current) => Math.max(0, current - 1))}
          onNext={() => setTeamPage((current) => current + 1)}
        />
          </TabsContent>

          <TabsContent value="clients" className="mt-0 space-y-4">
        <DistributorHeadListToolbar
          searchPlaceholder="Search clients by name, email, or distributor"
          searchValue={clientSearch}
          onSearchChange={(value) => {
            setClientSearch(value);
            setClientPage(0);
          }}
          filters={
            <Select
              value={clientStatusFilter}
              onValueChange={(value) => {
                setClientStatusFilter(value ?? CLIENT_STATUS_ALL);
                setClientPage(0);
              }}
            >
              <SelectTrigger size="sm" className="min-w-select-md">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLIENT_STATUS_ALL}>All clients</SelectItem>
                <SelectItem value="invested">Invested</SelectItem>
                <SelectItem value="not_invested">Not invested</SelectItem>
                <SelectItem value="kyc_pending">KYC pending</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <AdminDataTable minWidth="5xl">
          <AdminTableHeader>
            <tr>
              <AdminTableHeadCell>Client</AdminTableHeadCell>
              <AdminTableHeadCell>Distributor</AdminTableHeadCell>
              <AdminTableHeadCell>Branch</AdminTableHeadCell>
              <AdminTableHeadCell>AUM</AdminTableHeadCell>
              <AdminTableHeadCell>Investment</AdminTableHeadCell>
              <AdminTableHeadCell>KYC</AdminTableHeadCell>
            </tr>
          </AdminTableHeader>
          <AdminTableBody>
            <AdminTableRows
              colSpan={6}
              isEmpty={clientPagination.items.length === 0}
              emptyMessage="No clients match your filters."
            >
              {clientPagination.items.map((row) => (
                <AdminTableRow key={row.id}>
                  <AdminTableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-muted text-caption font-medium">
                          {initialsFromName(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium">{row.name}</p>
                        <p className="truncate text-caption text-muted-foreground">{row.email}</p>
                      </div>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge variant="outline" className="font-normal">
                      {row.distributorName}
                    </Badge>
                  </AdminTableCell>
                  <AdminTableCell>
                    <DistributorHeadChipBadge className="text-muted-foreground">
                      {row.branchName}
                    </DistributorHeadChipBadge>
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadInr(row.aumInr)}
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.hasInvested
                          ? "border-success/30 bg-success/10 text-success"
                          : "text-muted-foreground"
                      }
                    >
                      {row.hasInvested ? "Invested" : "Not invested"}
                    </Badge>
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.kycCompliant
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-warning/30 bg-warning/10 text-warning"
                      }
                    >
                      {row.kycCompliant ? "Compliant" : "Pending"}
                    </Badge>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableRows>
          </AdminTableBody>
        </AdminDataTable>

        <AdminTablePagination
          page={clientPagination.page}
          totalPages={clientPagination.totalPages}
          hasPrevious={clientPagination.hasPrevious}
          hasNext={clientPagination.hasNext}
          onPrevious={() => setClientPage((current) => Math.max(0, current - 1))}
          onNext={() => setClientPage((current) => current + 1)}
        />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
