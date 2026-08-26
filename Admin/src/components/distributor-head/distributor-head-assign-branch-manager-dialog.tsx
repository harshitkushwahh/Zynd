"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Label } from "@/components/ui/label";
import { pickUserRef } from "@/lib/admin-user-ref";
import {
  assignAdminHierarchyBranchManager,
  fetchAdminHierarchyBranchManagerCandidates,
  type AdminHierarchyBranch,
  type AdminHierarchyBranchManagerCandidate,
} from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadAssignBranchManagerDialogProps = {
  branch: AdminHierarchyBranch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
  replaceExisting?: boolean;
  title?: string;
  confirmLabel?: string;
};

export function DistributorHeadAssignBranchManagerDialog({
  branch,
  open,
  onOpenChange,
  onAssigned,
  replaceExisting = false,
  title = "Assign branch manager",
  confirmLabel = "Assign manager",
}: DistributorHeadAssignBranchManagerDialogProps) {
  const [candidates, setCandidates] = useState<AdminHierarchyBranchManagerCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [managerUserId, setManagerUserId] = useState("");
  const [managerSelectOpen, setManagerSelectOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setManagerSelectOpen(false);
      return;
    }

    setManagerUserId("");
    setError("");
    setCandidatesLoading(true);

    void fetchAdminHierarchyBranchManagerCandidates()
      .then((items) => {
        setCandidates(items);
        if (items.length === 1) {
          setManagerUserId(pickUserRef(items[0] ?? {}));
        }
      })
      .catch((err) => {
        setCandidates([]);
        setError(getErrorMessage(err, `Could not load ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} options.`));
      })
      .finally(() => setCandidatesLoading(false));
  }, [open]);

  const managerOptions = useMemo<AdminSelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: pickUserRef(candidate),
        label: `${candidate.name} · ${candidate.email}`,
      })),
    [candidates],
  );

  const handleSubmit = useCallback(async () => {
    if (!branch) return;

    setLoading(true);
    setError("");
    try {
      await assignAdminHierarchyBranchManager(branch.id, managerUserId, { replaceExisting });
      onOpenChange(false);
      onAssigned?.();
    } catch (err) {
      setError(getErrorMessage(err, `Could not assign ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [branch, managerUserId, onAssigned, onOpenChange]);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        branch
          ? `Choose a ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} for ${branch.name} (${branch.branch_code ?? branch.id.toUpperCase()}).`
          : undefined
      }
      icon={UserPlus}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel={confirmLabel}
            loading={loading}
            confirmDisabled={!branch || !managerUserId || candidatesLoading || candidates.length === 0}
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <div className="space-y-2">
        <Label htmlFor="assign-branch-manager">{MITRA_HIERARCHY_COPY.branchManager}</Label>
        {candidatesLoading ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading {MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} options…
          </div>
        ) : candidates.length === 0 ? (
          <AdminFeedbackMessage variant="info">
            No available {MITRA_HIERARCHY_COPY.branchManagers.toLowerCase()} yet. Invite one first, then assign them
            here.
          </AdminFeedbackMessage>
        ) : (
          <AdminSelect
            value={managerUserId}
            open={managerSelectOpen}
            onOpenChange={setManagerSelectOpen}
            size="default"
            onValueChange={setManagerUserId}
            options={managerOptions}
            placeholder={`Select ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()}`}
            className="w-full"
            triggerClassName="w-full"
          />
        )}
      </div>
    </AdminFormDialog>
  );
}
