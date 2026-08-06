"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Plus } from "lucide-react";

import { DistributorHeadAddStateHeadDialog } from "@/components/distributor-head/distributor-head-add-state-head-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Button } from "@/components/ui/button";
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
import { DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION } from "@/lib/admin-distributor-head-navigation";
import {
  fetchAdminHierarchyOverview,
  fetchAdminHierarchyStateHeads,
  type AdminHierarchyStateHead,
} from "@/lib/admin-distributor-hierarchy-api";
import { matchesHierarchyStateHeadSearch } from "@/lib/admin-distributor-hierarchy-mappers";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";

type DistributorHeadStateHeadsPanelProps = {
  defaultStateCode?: string;
  defaultStateName?: string;
};

export function DistributorHeadStateHeadsPanel({
  defaultStateCode = "MH",
  defaultStateName = "Maharashtra",
}: DistributorHeadStateHeadsPanelProps) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);
  const [items, setItems] = useState<AdminHierarchyStateHead[]>([]);
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
      const [result, overview] = await Promise.all([
        fetchAdminHierarchyStateHeads(),
        fetchAdminHierarchyOverview().catch(() => null),
      ]);
      setItems(result);
      if (overview) {
        setStateCode(overview.state_code);
        setStateName(overview.state_name);
      }
    } catch (err) {
      setItems([]);
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
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

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

      <AdminDataTable minWidth="4xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Name</AdminTableHeadCell>
            <AdminTableHeadCell>Email</AdminTableHeadCell>
            <AdminTableHeadCell>State</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableStateRow colSpan={3}>
              Loading {MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}s…
            </AdminTableStateRow>
          ) : filtered.length === 0 ? (
            <AdminTableStateRow colSpan={3}>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                {!search.trim() ? <Crown className="size-4 opacity-70" /> : null}
                {emptyMessage}
              </span>
            </AdminTableStateRow>
          ) : (
            filtered.map((row) => (
              <AdminTableRow key={row.user_id}>
                <AdminTableCell className="font-medium">{row.name}</AdminTableCell>
                <AdminTableCell>{row.email}</AdminTableCell>
                <AdminTableCell>
                  {row.state_name} ({row.state_code})
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
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
