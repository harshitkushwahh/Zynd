"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Plus } from "lucide-react";

import { DistributorHeadAddStateHeadDialog } from "@/components/distributor-head/distributor-head-add-state-head-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableSkeletonRows,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION } from "@/lib/admin-distributor-head-navigation";
import { pickUserRef } from "@/lib/admin-user-ref";
import { distributorHeadStateHeadHref } from "@/lib/admin-distributor-head-state-head-navigation";
import {
  fetchAdminHierarchyOverview,
  fetchAdminHierarchyStateHeads,
  fetchAdminHierarchyUnassignedStates,
  type AdminHierarchyStateHead,
  type AdminHierarchyUnassignedState,
} from "@/lib/admin-distributor-hierarchy-api";
import { matchesHierarchyStateHeadSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { formatDistributorHeadCount } from "@/lib/distributor-head-format";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";

type DistributorHeadStateHeadsPanelProps = {
  defaultStateCode?: string;
  defaultStateName?: string;
};

const TABLE_COLUMN_COUNT = 8;

export function DistributorHeadStateHeadsPanel({
  defaultStateCode = "MH",
  defaultStateName = "Maharashtra",
}: DistributorHeadStateHeadsPanelProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);
  const [items, setItems] = useState<AdminHierarchyStateHead[]>([]);
  const [unassignedStates, setUnassignedStates] = useState<AdminHierarchyUnassignedState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [stateCode, setStateCode] = useState(defaultStateCode);
  const [stateName, setStateName] = useState(defaultStateName);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, overview, unassigned] = await Promise.all([
        fetchAdminHierarchyStateHeads(),
        fetchAdminHierarchyOverview().catch(() => null),
        fetchAdminHierarchyUnassignedStates().catch(() => [] as AdminHierarchyUnassignedState[]),
      ]);
      setItems(result);
      setUnassignedStates(unassigned);
      if (overview) {
        setStateCode(overview.state_code);
        setStateName(overview.state_name);
      }
    } catch (err) {
      setItems([]);
      setUnassignedStates([]);
      if (!isIgnorableListLoadError(err)) {
        setError(getErrorMessage(err, `Could not load ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} records.`));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((row) => matchesHierarchyStateHeadSearch(row, search)),
    [items, search],
  );

  const emptyMessage = search.trim()
    ? `No ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}s match your search.`
    : `No ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned yet.${canManage ? " Use Add to assign one." : ""}`;

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {!loading && unassignedStates.length > 0 ? (
        <AdminFeedbackMessage variant="warning">
          {unassignedStates.length === 1
            ? `No ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned for ${unassignedStates[0]?.state_name} (${unassignedStates[0]?.state_code}). Branch managers and ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} stay under the state until you assign someone.`
            : `${unassignedStates.length} states have no ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned. Branch managers and ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} stay under those states until you assign someone.`}
        </AdminFeedbackMessage>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder={`Search ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}s by name, email, or state`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {canManage ? (
          <Button type="button" size="sm" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add {MITRA_HIERARCHY_COPY.stateHead}
          </Button>
        ) : null}
      </div>

      <AdminDataTable minWidth="7xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Email</AdminTableHeadCell>
            <AdminTableHeadCell>State</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.branchManagers}</AdminTableHeadCell>
            <AdminTableHeadCell>Branches</AdminTableHeadCell>
            <AdminTableHeadCell>{MITRA_HIERARCHY_COPY.zyndMitras}</AdminTableHeadCell>
            <AdminTableHeadCell>Clients</AdminTableHeadCell>
            <AdminTableHeadCell>Pending</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={TABLE_COLUMN_COUNT} rows={6} />
          ) : filtered.length === 0 && (search.trim() || unassignedStates.length === 0) ? (
            <AdminTableStateRow colSpan={TABLE_COLUMN_COUNT}>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                {!search.trim() ? <Crown className="size-4 opacity-70" /> : null}
                {emptyMessage}
              </span>
            </AdminTableStateRow>
          ) : (
            filtered.map((row) => {
              const pendingBranches = row.pending_branch_count ?? 0;
              const unassignedBranches = row.unassigned_branch_count ?? 0;
              const pendingTotal = pendingBranches + unassignedBranches;
              return (
                <AdminTableRow
                  key={pickUserRef(row)}
                  onClick={() => router.push(distributorHeadStateHeadHref(pickUserRef(row)))}
                >
                  <AdminTableCell className="font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.name}
                      {row.status === "paused" ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning/10 font-normal text-warning"
                        >
                          Paused
                        </Badge>
                      ) : null}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>{row.email}</AdminTableCell>
                  <AdminTableCell>
                    {row.state_name} ({row.state_code})
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadCount(row.manager_count ?? 0)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadCount(row.branch_count ?? 0)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadCount(row.partner_count ?? 0)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">
                    {formatDistributorHeadCount(row.client_count ?? 0)}
                  </AdminTableCell>
                  <AdminTableCell>
                    {pendingTotal > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-warning/40 bg-warning/10 text-warning font-normal"
                      >
                        {pendingBranches > 0
                          ? `${pendingBranches} branch${pendingBranches === 1 ? "" : "es"}`
                          : null}
                        {pendingBranches > 0 && unassignedBranches > 0 ? " · " : null}
                        {unassignedBranches > 0
                          ? `${unassignedBranches} unassigned`
                          : null}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="pointer-events-none border-border/60 bg-muted/40 font-normal text-muted-foreground opacity-70"
                        aria-disabled
                      >
                        None pending
                      </Badge>
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              );
            })
          )}
          {!loading && !search.trim()
            ? unassignedStates.map((row) => (
                <AdminTableRow key={`unassigned-${row.state_code}`}>
                  <AdminTableCell className="text-muted-foreground">Unassigned</AdminTableCell>
                  <AdminTableCell className="text-muted-foreground">—</AdminTableCell>
                  <AdminTableCell>
                    {row.state_name} ({row.state_code})
                  </AdminTableCell>
                  <AdminTableCell className="text-muted-foreground" colSpan={4}>
                    No {MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned for this state.
                  </AdminTableCell>
                  <AdminTableCell>
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStateCode(row.state_code);
                          setStateName(row.state_name);
                          setAddOpen(true);
                        }}
                      >
                        Assign
                      </Button>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        Unassigned
                      </Badge>
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              ))
            : null}
        </AdminTableBody>
      </AdminDataTable>

      <DistributorHeadAddStateHeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStateCode={stateCode}
        defaultStateName={stateName}
        onCreated={() => void load()}
      />
    </div>
  );
}
