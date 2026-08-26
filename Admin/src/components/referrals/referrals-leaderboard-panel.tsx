"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

import {
  ReferralsLeaderboardSettingsDialog,
} from "@/components/referrals/referrals-leaderboard-settings-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
  AdminTableStateRow,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { userDashboardProfileHref } from "@/lib/admin-user-ref";
import {
  fetchAdminReferralLeaderboardMonths,
  formatReferralInr,
  snapshotAdminReferralLeaderboard,
  type AdminReferralLeaderboardEntry,
  type AdminReferralLeaderboardMonth,
} from "@/lib/referrals-admin-api";
import { useAdminSearch } from "@/hooks/use-admin-search";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const ROLLING_PERIOD_OPTIONS: AdminSelectOption[] = [
  { value: "this_month", label: "This month (live)" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "all_time", label: "All time" },
];

export function ReferralsLeaderboardPanel() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("referrals.manage");
  const [months, setMonths] = useState<AdminReferralLeaderboardMonth[]>([]);
  const [period, setPeriod] = useState("this_month");
  const [search, setSearch] = useState("");
  const [snapshotting, setSnapshotting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    items,
    loading,
    error: searchError,
    refetch,
  } = useAdminSearch<AdminReferralLeaderboardEntry>({
    scope: "referrals.leaderboard",
    query: search,
    period,
    limit: 100,
  });

  const periodOptions = useMemo<AdminSelectOption[]>(() => {
    const monthOptions = months.map((month) => ({
      value: month.period_key,
      label: month.is_current ? `${month.label} (current)` : month.label,
    }));
    return [...monthOptions, ...ROLLING_PERIOD_OPTIONS];
  }, [months]);

  const loadMonths = useCallback(async () => {
    try {
      const result = await fetchAdminReferralLeaderboardMonths(12);
      setMonths(result.items);
      if (result.items.length > 0) {
        setPeriod((current) => current || result.items[0].period_key);
      }
    } catch {
      setMonths([]);
    }
  }, []);

  useEffect(() => {
    void loadMonths();
  }, [loadMonths]);

  const selectedMonth = months.find((month) => month.period_key === period);
  const isSnapshot = Boolean(selectedMonth?.has_snapshot);
  const isFinal = false;
  const displayError = error || searchError;

  const handleSnapshot = async (finalize: boolean) => {
    if (!selectedMonth) return;
    setSnapshotting(true);
    setError("");
    setSuccess("");
    try {
      const result = await snapshotAdminReferralLeaderboard(selectedMonth.period_key, finalize);
      setSuccess(
        finalize
          ? `Finalized ${result.period_key} with ${result.rows} ranked referrers.`
          : `Saved snapshot for ${result.period_key} (${result.rows} referrers).`,
      );
      await loadMonths();
      await refetch();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save leaderboard snapshot."));
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm"
          placeholder="Search referrer or code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={period}
            onValueChange={setPeriod}
            options={periodOptions}
            placeholder="Period"
            className="min-w-select-sm"
            triggerClassName="w-auto min-w-[180px]"
          />
          {canManage ? (
            <Button type="button" size="sm" onClick={() => setSettingsOpen(true)}>
              Configure
            </Button>
          ) : null}
          {selectedMonth ? (
            <div className="flex items-center gap-2">
              {selectedMonth.has_snapshot ? (
                <StatusBadge variant={isFinal ? "success" : "neutral"}>
                  {isFinal ? "Finalized" : "Snapshot"}
                </StatusBadge>
              ) : (
                <StatusBadge variant="neutral">Live</StatusBadge>
              )}
            </div>
          ) : null}
          <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          {canManage && selectedMonth ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={snapshotting}
                onClick={() => void handleSnapshot(false)}
              >
                <Camera className="size-3.5" />
                Save snapshot
              </Button>
              {!selectedMonth.is_current ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={snapshotting}
                  onClick={() => void handleSnapshot(true)}
                >
                  Finalize month
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {displayError ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {displayError}
        </AdminFeedbackMessage>
      ) : null}
      {success ? (
        <AdminFeedbackMessage variant="success" onDismiss={() => setSuccess("")}>
          {success}
        </AdminFeedbackMessage>
      ) : null}

      <AdminDataTable minWidth="md">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Rank</AdminTableHeadCell>
            <AdminTableHeadCell>Referrer</AdminTableHeadCell>
            <AdminTableHeadCell>Code</AdminTableHeadCell>
            <AdminTableHeadCell>Score</AdminTableHeadCell>
            <AdminTableHeadCell>Est. earnings</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading && items.length === 0 ? (
            <AdminTableSkeletonRows columns={5} />
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              {search.trim() ? "No referrers match your search." : "No leaderboard data for this period."}
            </AdminTableStateRow>
          ) : (
            items.map((item) => (
              <AdminTableRow key={`${item.rank}-${item.user?.user_id ?? item.display_name}`}>
                <AdminTableCell>{item.rank}</AdminTableCell>
                <AdminTableCell>
                  {item.user ? (
                    <Link
                      href={userDashboardProfileHref(item.user.client_id, "referrals")}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.user.display_name}
                    </Link>
                  ) : (
                    item.display_name
                  )}
                  {item.user ? (
                    <p className="text-caption text-muted-foreground">{item.user.email}</p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>{item.referral_code ?? "—"}</AdminTableCell>
                <AdminTableCell>{item.referral_count}</AdminTableCell>
                <AdminTableCell>{formatReferralInr(item.estimated_earnings_inr)}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {isSnapshot ? (
        <p className="text-caption text-muted-foreground">
          Showing a saved snapshot for this month.
        </p>
      ) : null}

      <ReferralsLeaderboardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => {
          setSuccess("Leaderboard settings saved.");
          void refetch();
        }}
      />
    </div>
  );
}
