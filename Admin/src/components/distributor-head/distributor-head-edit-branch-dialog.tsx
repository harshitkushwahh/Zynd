"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAdminHierarchyBranch,
  type AdminHierarchyBranchDetail,
} from "@/lib/admin-distributor-hierarchy-api";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadEditBranchDialogProps = {
  branch: AdminHierarchyBranchDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (branch: AdminHierarchyBranchDetail) => void;
};

export function DistributorHeadEditBranchDialog({
  branch,
  open,
  onOpenChange,
  onUpdated,
}: DistributorHeadEditBranchDialogProps) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !branch) return;
    setName(branch.name);
    setCity(branch.city ?? "");
    setError("");
  }, [branch, open]);

  const handleSubmit = async () => {
    if (!branch) return;
    setLoading(true);
    setError("");
    try {
      const result = await updateAdminHierarchyBranch(branch.id, {
        name: name.trim(),
        city: city.trim() || undefined,
      });
      onOpenChange(false);
      onUpdated?.(result.branch);
    } catch (err) {
      setError(getErrorMessage(err, "Could not update branch."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit branch details"
      description={
        branch
          ? `Update ${branch.name} (${branch.branch_code ?? branch.id.toUpperCase()}).`
          : undefined
      }
      icon={Building2}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Save changes"
            loading={loading}
            confirmDisabled={!branch || name.trim().length < 2}
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-branch-name">Branch name</Label>
          <Input
            id="edit-branch-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-branch-city">City</Label>
          <Input
            id="edit-branch-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
      </div>
    </AdminFormDialog>
  );
}
