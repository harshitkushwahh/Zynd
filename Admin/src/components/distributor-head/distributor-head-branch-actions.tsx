"use client";

import { useState } from "react";
import {
  Check,
  MoreHorizontal,
  Pencil,
  UserMinus,
  UserPlus,
  UserRoundCog,
  X,
} from "lucide-react";

import { DistributorHeadAssignBranchManagerDialog } from "@/components/distributor-head/distributor-head-assign-branch-manager-dialog";
import { DistributorHeadEditBranchDialog } from "@/components/distributor-head/distributor-head-edit-branch-dialog";
import { AdminCenteredConfirmDialog } from "@/components/ui/admin-centered-confirm-dialog";
import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  approveAdminHierarchyBranch,
  rejectAdminHierarchyBranch,
  unassignAdminHierarchyBranchManager,
  type AdminHierarchyBranchDetail,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  canAssignBranchManager,
  canChangeBranchManager,
  canEditBranchDetails,
  canRemoveBranchManager,
} from "@/lib/distributor-branch-manager";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadBranchActionsProps = {
  branch: AdminHierarchyBranchDetail;
  canApprove: boolean;
  canManage: boolean;
  currentUserId?: string | null;
  compact?: boolean;
  onUpdated: (next: AdminHierarchyBranchDetail) => void;
  onAssigned?: () => void;
};

export function DistributorHeadBranchActions({
  branch,
  canApprove,
  canManage,
  currentUserId,
  compact = false,
  onUpdated,
  onAssigned,
}: DistributorHeadBranchActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const managerOptions = {
    canManageBranches: canManage,
    canApproveBranches: canApprove,
    currentUserId,
  };

  const showAssign = canAssignBranchManager(branch, managerOptions);
  const showChange = canChangeBranchManager(branch, managerOptions);
  const showRemove = canRemoveBranchManager(branch, managerOptions);
  const showEdit = canEditBranchDetails(branch, managerOptions);
  const showApprove = canApprove && branch.status === "pending_approval";

  const showManage =
    showApprove || showAssign || showChange || showRemove || showEdit;

  if (!showManage) return null;

  const handleApprove = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await approveAdminHierarchyBranch(branch.id);
      onUpdated({ ...branch, ...result.branch });
      setConfirmApprove(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not approve branch."));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await rejectAdminHierarchyBranch(branch.id, rejectReason);
      onUpdated({ ...branch, ...result.branch });
      setRejectOpen(false);
      setRejectReason("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject branch."));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveManager = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await unassignAdminHierarchyBranchManager(branch.id);
      onUpdated({ ...branch, ...result.branch });
      setRemoveOpen(false);
      onAssigned?.();
    } catch (err) {
      setError(getErrorMessage(err, `Could not remove ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={compact ? "ghost" : "outline"}
              size={compact ? "icon" : "sm"}
              className={compact ? "size-8 shrink-0" : "shrink-0 gap-1.5"}
              aria-label="Branch actions"
            >
              <MoreHorizontal className="size-4" />
              {compact ? null : "Manage"}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-52">
          {showEdit ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit branch details
            </DropdownMenuItem>
          ) : null}
          {showApprove ? (
            <>
              <DropdownMenuItem onClick={() => setConfirmApprove(true)}>
                <Check className="size-4" />
                Approve opening
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setRejectOpen(true)}>
                <X className="size-4" />
                Reject opening
              </DropdownMenuItem>
            </>
          ) : null}
          {showAssign ? (
            <DropdownMenuItem onClick={() => setAssignOpen(true)}>
              <UserPlus className="size-4" />
              {branch.manager_unavailable ? "Assign new manager" : "Assign manager"}
            </DropdownMenuItem>
          ) : null}
          {showChange ? (
            <DropdownMenuItem onClick={() => setChangeOpen(true)}>
              <UserRoundCog className="size-4" />
              Change manager
            </DropdownMenuItem>
          ) : null}
          {showRemove ? (
            <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>
              <UserMinus className="size-4" />
              Remove manager
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AdminCenteredConfirmDialog
        open={confirmApprove}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setConfirmApprove(false);
            setError("");
          }
        }}
        title="Approve branch opening?"
        description={
          error
            ? `Activate ${branch.name} (${branch.branch_code ?? branch.id.toUpperCase()})?\n\n${error}`
            : `Activate ${branch.name} (${branch.branch_code ?? branch.id.toUpperCase()}) so ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} can onboard under this branch.`
        }
        icon={Check}
        iconTone="success"
        confirmLabel="Approve"
        loading={loading}
        onConfirm={() => void handleApprove()}
      />

      <AdminFormDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (loading) return;
          setRejectOpen(open);
          if (!open) {
            setError("");
            setRejectReason("");
          }
        }}
        title="Reject branch opening"
        description={`Decline the opening request for ${branch.name}.`}
        icon={X}
        size="md"
        footer={
          <AdminDialogFooterActions
            onCancel={() => setRejectOpen(false)}
            onConfirm={() => void handleReject()}
            confirmLabel="Reject"
            confirmVariant="destructive"
            loading={loading}
          />
        }
      >
        <div className="space-y-4">
          {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
          <div className="space-y-2">
            <Label htmlFor="reject-branch-reason">Reason (optional)</Label>
            <textarea
              id="reject-branch-reason"
              rows={3}
              placeholder="Share why this opening request was declined"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="flex min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-compact text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>
      </AdminFormDialog>

      <AdminCenteredConfirmDialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setRemoveOpen(false);
            setError("");
          }
        }}
        title={`Remove ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()}?`}
        description={
          error
            ? error
            : `Clear the ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} assignment for ${branch.name}. You can assign someone else afterward.`
        }
        icon={UserMinus}
        iconTone="destructive"
        confirmLabel="Remove manager"
        confirmVariant="destructive"
        loading={loading}
        onConfirm={() => void handleRemoveManager()}
      />

      <DistributorHeadAssignBranchManagerDialog
        branch={branch}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssigned={() => {
          setAssignOpen(false);
          onAssigned?.();
        }}
      />

      <DistributorHeadAssignBranchManagerDialog
        branch={branch}
        open={changeOpen}
        onOpenChange={setChangeOpen}
        replaceExisting
        title="Change branch manager"
        confirmLabel="Change manager"
        onAssigned={() => {
          setChangeOpen(false);
          onAssigned?.();
        }}
      />

      <DistributorHeadEditBranchDialog
        branch={branch}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={(next) => onUpdated(next)}
      />
    </>
  );
}
