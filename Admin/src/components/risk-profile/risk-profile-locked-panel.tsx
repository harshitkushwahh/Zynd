"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, MoreHorizontal, CheckCircle2, RefreshCw } from "lucide-react";

import { LockedProfileUserCell } from "@/components/risk-profile/risk-profile-locked-user-cell";
import { RiskProfileUnlockJourneyDialog } from "@/components/risk-profile/risk-profile-unlock-journey-dialog";
import {
  AdminDialogFooterActions,
  AdminFormDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import {
  confirmRiskProfileUnlock,
  requestRiskProfileUnlock,
  type LockedRiskProfileUser,
} from "@/lib/risk-profile-admin-api";
import {
  lockedRiskProfilesQueryKey,
  useLockedRiskProfilesQuery,
} from "@/hooks/use-risk-profile-queries";
import { cn } from "@/lib/utils";

const RISK_PROFILE_UNLOCK_ATTEMPTS = 3;

export function RiskProfileLockedPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<LockedRiskProfileUser | null>(null);
  const [journeyUser, setJourneyUser] = useState<LockedRiskProfileUser | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const queryParams = { limit: pageSize, offset };
  const { data, isPending, isFetching, error: queryError } = useLockedRiskProfilesQuery(queryParams);
  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isPending && !data;
  const loadError = queryError
    ? getErrorMessage(queryError, "Could not load locked risk profiles.")
    : "";

  const refreshLockedUsers = () =>
    queryClient.invalidateQueries({ queryKey: lockedRiskProfilesQueryKey(queryParams) });

  const openRevokeDialog = (user: LockedRiskProfileUser) => {
    setSelectedUser(user);
    setOtpCode("");
    setOtpSent(false);
    setMessage("");
    setError("");
  };

  const closeRevokeDialog = () => {
    setSelectedUser(null);
    setOtpCode("");
    setOtpSent(false);
  };

  const handleSendOtp = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await requestRiskProfileUnlock(selectedUser.user_id);
      setOtpSent(true);
      setMessage("Unlock code sent to the user's in-app notifications.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not send unlock code."));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await confirmRiskProfileUnlock(selectedUser.user_id, {
        otp_code: otpCode.trim(),
      });
      setMessage(`Granted ${RISK_PROFILE_UNLOCK_ATTEMPTS} attempt(s) to ${selectedUser.email}.`);
      closeRevokeDialog();
      await refreshLockedUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Could not unlock risk profile attempts."));
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.display_name, item.email, item.client_id].join(" ").toLowerCase().includes(query),
    );
  }, [items, search]);

  const columnCount = canManage ? 5 : 4;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by name, email, or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => void refreshLockedUsers()}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {error || loadError ? (
        <AdminFeedbackMessage variant="destructive">{error || loadError}</AdminFeedbackMessage>
      ) : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={isFetching}
            currentPageCount={filteredItems.length}
            hasMore={hasMore}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOffset(0);
            }}
            onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
            onNext={() => setOffset((value) => value + pageSize)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Completed</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Granted</AdminTableHeadCell>
            <AdminTableHeadCell>Locked at</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={columnCount} />
          ) : filteredItems.length === 0 ? (
            <AdminTableStateRow colSpan={columnCount}>
              {items.length === 0 ? "No locked risk profiles." : "No users match your search."}
            </AdminTableStateRow>
          ) : (
            filteredItems.map((item) => (
              <AdminTableRow key={item.user_id}>
                {canManage ? (
                  <AdminTableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-sm" variant="ghost" aria-label="Row actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setJourneyUser(item)}>
                          View journey
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRevokeDialog(item)}>
                          Revoke lock
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <LockedProfileUserCell user={item} />
                </AdminTableCell>
                <AdminTableCell className="text-right">{item.completed_count}</AdminTableCell>
                <AdminTableCell className="text-right">{item.granted_attempts}</AdminTableCell>
                <AdminTableCell>
                  {item.locked_at ? new Date(item.locked_at).toLocaleString() : "—"}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminFormDialog
        open={Boolean(selectedUser)}
        onClose={closeRevokeDialog}
        title="Revoke lock"
        description="Send a code to their dashboard notifications."
        icon={Lock}
        iconTone="warning"
        footer={
          otpSent ? (
            <AdminDialogFooterActions
              cancelLabel="Cancel"
              confirmLabel="Grant attempts"
              loading={saving}
              confirmDisabled={!otpCode.trim()}
              onCancel={closeRevokeDialog}
              onConfirm={() => void handleConfirmUnlock()}
            />
          ) : (
            <AdminDialogFooterActions
              cancelLabel="Cancel"
              confirmLabel="Send unlock code"
              loading={saving}
              onCancel={closeRevokeDialog}
              onConfirm={() => void handleSendOtp()}
            />
          )
        }
      >
        {selectedUser ? (
          <div className="grid gap-4">
            <div className="rounded-[var(--radius-control)] border border-border bg-muted/20 px-3 py-2 text-compact">
              <LockedProfileUserCell user={selectedUser} />
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                Completed {selectedUser.completed_count} of {selectedUser.granted_attempts} granted attempts.
              </p>
            </div>
            {otpSent ? (
              <div className="space-y-2">
                <Label htmlFor="risk-unlock-otp">Unlock code from user</Label>
                <Input
                  id="risk-unlock-otp"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="6-digit code"
                />
                <p className="text-caption text-muted-foreground">
                  Confirming will grant {RISK_PROFILE_UNLOCK_ATTEMPTS} additional assessment attempts.
                </p>
              </div>
            ) : (
              <AdminFeedbackMessage variant="info">
                The user will receive the unlock code in their in-app notifications. Ask them to read it back to
                you before confirming.
              </AdminFeedbackMessage>
            )}
          </div>
        ) : null}
      </AdminFormDialog>

      <RiskProfileUnlockJourneyDialog
        open={Boolean(journeyUser)}
        user={journeyUser}
        onClose={() => setJourneyUser(null)}
      />
    </div>
  );
}
