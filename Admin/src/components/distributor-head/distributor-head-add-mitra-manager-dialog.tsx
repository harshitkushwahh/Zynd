"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, Users2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { pickUserRef } from "@/lib/admin-user-ref";
import {
  assignAdminHierarchyBranchManager,
  fetchAdminHierarchyBranchManagerCandidates,
  fetchAdminHierarchyBranches,
  fetchAdminHierarchyOverview,
  inviteAdminHierarchyMitraManager,
  type AdminHierarchyBranch,
  type AdminHierarchyBranchManagerCandidate,
} from "@/lib/admin-distributor-hierarchy-api";
import { DISTRIBUTOR_HEAD_BRANCHES_APPROVE_PERMISSION } from "@/lib/admin-distributor-head-navigation";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadAddMitraManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  onInvited?: (email: string) => void;
};

export function DistributorHeadAddMitraManagerDialog({
  open,
  onOpenChange,
  onCreated,
  onInvited,
}: DistributorHeadAddMitraManagerDialogProps) {
  const { hasPermission, user } = useAdminAuth();
  const canApproveBranches = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_APPROVE_PERMISSION);
  const [branchId, setBranchId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [lockedState, setLockedState] = useState<{ state_code: string; state_name: string } | null>(
    null,
  );
  const [branches, setBranches] = useState<AdminHierarchyBranch[]>([]);
  const [candidates, setCandidates] = useState<AdminHierarchyBranchManagerCandidate[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branchSelectOpen, setBranchSelectOpen] = useState(false);
  const [managerSelectOpen, setManagerSelectOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setBranchSelectOpen(false);
      setManagerSelectOpen(false);
      return;
    }

    setBranchId("");
    setManagerUserId("");
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setError("");
    setLoadingData(true);

    void Promise.all([
      fetchAdminHierarchyBranchManagerCandidates(),
      fetchAdminHierarchyBranches(),
      fetchAdminHierarchyOverview().catch(() => null),
    ])
      .then(([candidateItems, branchItems, overview]) => {
        setCandidates(candidateItems);
        setBranches(branchItems);
        if (candidateItems.length === 1) {
          setManagerUserId(pickUserRef(candidateItems[0] ?? {}));
        }
        if (overview?.state_code && overview.state_name) {
          setLockedState({
            state_code: overview.state_code,
            state_name: overview.state_name,
          });
        } else {
          setLockedState(null);
        }
      })
      .catch((err) => {
        setCandidates([]);
        setBranches([]);
        setLockedState(null);
        setError(getErrorMessage(err, `Could not load ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()} options.`));
      })
      .finally(() => setLoadingData(false));
  }, [open]);

  const assignableBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          branch.status === "active" &&
          !branch.manager_id &&
          (canApproveBranches ||
            !branch.created_by_user_id ||
            branch.created_by_user_id === user?.id),
      ),
    [branches, canApproveBranches, user?.id],
  );

  const branchOptions = useMemo<AdminSelectOption[]>(
    () =>
      assignableBranches.map((branch) => ({
        value: branch.id,
        label: `${branch.name} · ${branch.branch_code ?? branch.id.toUpperCase()}`,
      })),
    [assignableBranches],
  );

  const managerOptions = useMemo<AdminSelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: pickUserRef(candidate),
        label: `${candidate.name} · ${candidate.email}`,
      })),
    [candidates],
  );

  const assignMode = Boolean(branchId && managerUserId);
  const inviteMode = Boolean(inviteEmail.trim()) && !assignMode;

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (assignMode) {
        await assignAdminHierarchyBranchManager(branchId, managerUserId);
        onOpenChange(false);
        onCreated?.();
        return;
      }

      const result = await inviteAdminHierarchyMitraManager({
        email: inviteEmail.trim(),
        first_name: inviteFirstName.trim() || undefined,
        last_name: inviteLastName.trim() || undefined,
      });
      onOpenChange(false);
      onInvited?.(result.invitation.email);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          assignMode
            ? `Could not assign ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()}.`
            : `Could not invite ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()}.`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    assignMode,
    branchId,
    inviteEmail,
    inviteFirstName,
    inviteLastName,
    managerUserId,
    onCreated,
    onInvited,
    onOpenChange,
  ]);

  const canAssign = assignableBranches.length > 0 && candidates.length > 0;
  const submitDisabled =
    loadingData || loading || (!assignMode && !inviteMode) || (assignMode && !canAssign);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add ${MITRA_HIERARCHY_COPY.mitraManager}`}
      description={
        lockedState
          ? `Invite or assign a ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()} for ${lockedState.state_name} (${lockedState.state_code}).`
          : `Invite or assign a ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()} to an active branch.`
      }
      icon={Users2}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel={assignMode ? "Assign manager" : "Send invitation"}
            confirmIcon={UserPlus}
            loading={loading}
            confirmDisabled={submitDisabled}
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mitra-manager-invite-email">Work email</Label>
            <Input
              id="mitra-manager-invite-email"
              type="email"
              placeholder="manager@company.com"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mitra-manager-invite-first-name">First name (optional)</Label>
              <Input
                id="mitra-manager-invite-first-name"
                value={inviteFirstName}
                onChange={(event) => setInviteFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mitra-manager-invite-last-name">Last name (optional)</Label>
              <Input
                id="mitra-manager-invite-last-name"
                value={inviteLastName}
                onChange={(event) => setInviteLastName(event.target.value)}
              />
            </div>
          </div>
        </div>

        {canAssign || loadingData ? (
          <div className="space-y-4 border-t border-border pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium">Assign existing</p>
              <p className="text-sm text-muted-foreground">
                Link an onboarded {MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()} to an approved branch.
              </p>
            </div>

            {loadingData ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading assignment options…
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mitra-manager-branch">Branch</Label>
                  {assignableBranches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No approved branches without a manager yet.
                    </p>
                  ) : (
                    <AdminSelect
                      value={branchId}
                      open={branchSelectOpen}
                      onOpenChange={setBranchSelectOpen}
                      size="default"
                      onValueChange={setBranchId}
                      options={branchOptions}
                      placeholder="Select branch"
                      className="w-full"
                      triggerClassName="w-full"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mitra-manager-user">{MITRA_HIERARCHY_COPY.mitraManager}</Label>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No onboarded {MITRA_HIERARCHY_COPY.mitraManagers.toLowerCase()} yet.
                    </p>
                  ) : (
                    <AdminSelect
                      value={managerUserId}
                      open={managerSelectOpen}
                      onOpenChange={setManagerSelectOpen}
                      size="default"
                      onValueChange={setManagerUserId}
                      options={managerOptions}
                      placeholder={`Select ${MITRA_HIERARCHY_COPY.mitraManager.toLowerCase()}`}
                      className="w-full"
                      triggerClassName="w-full"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </AdminFormDialog>
  );
}
