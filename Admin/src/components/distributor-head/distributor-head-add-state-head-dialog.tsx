"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminHierarchyStateHead,
  fetchAdminHierarchyStateHeadCandidates,
  type AdminHierarchyStateHeadCandidate,
  type CreateAdminStateHeadPayload,
} from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type DistributorHeadAddStateHeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStateCode?: string;
  defaultStateName?: string;
  onCreated?: () => void;
};

type StateHeadFormState = CreateAdminStateHeadPayload;

export function DistributorHeadAddStateHeadDialog({
  open,
  onOpenChange,
  defaultStateCode = "MH",
  defaultStateName = "Maharashtra",
  onCreated,
}: DistributorHeadAddStateHeadDialogProps) {
  const [form, setForm] = useState<StateHeadFormState>({
    user_id: "",
    state_code: defaultStateCode,
    state_name: defaultStateName,
  });
  const [candidates, setCandidates] = useState<AdminHierarchyStateHeadCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userSelectOpen, setUserSelectOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setUserSelectOpen(false);
      return;
    }

    setForm({
      user_id: "",
      state_code: defaultStateCode,
      state_name: defaultStateName,
    });
    setError("");
    setCandidatesLoading(true);

    void fetchAdminHierarchyStateHeadCandidates()
      .then((items) => {
        setCandidates(items);
        if (items.length === 1) {
          setForm((current) => ({ ...current, user_id: items[0]?.user_id ?? "" }));
        }
      })
      .catch((err) => {
        setCandidates([]);
        setError(getErrorMessage(err, "Could not load admin user options."));
      })
      .finally(() => setCandidatesLoading(false));
  }, [defaultStateCode, defaultStateName, open]);

  const userOptions = useMemo<AdminSelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: candidate.user_id,
        label: `${candidate.name} · ${candidate.email}`,
      })),
    [candidates],
  );

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await createAdminHierarchyStateHead({
        user_id: form.user_id,
        state_code: form.state_code.trim().toUpperCase(),
        state_name: form.state_name.trim(),
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(getErrorMessage(err, `Could not assign ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [form, onCreated, onOpenChange]);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add ${MITRA_HIERARCHY_COPY.stateHead}`}
      description="Assign an existing admin user to one state in the Mitra hierarchy."
      icon={Crown}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel={`Assign ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()}`}
            loading={loading}
            confirmDisabled={
              !form.user_id ||
              !form.state_code.trim() ||
              !form.state_name.trim() ||
              candidatesLoading
            }
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="state-head-user">Admin user</Label>
          {candidatesLoading ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading admin users…
            </div>
          ) : (
            <AdminSelect
              value={form.user_id}
              open={userSelectOpen}
              onOpenChange={setUserSelectOpen}
              size="default"
              onValueChange={(value) => setForm((current) => ({ ...current, user_id: value }))}
              options={userOptions}
              placeholder="Select admin user"
              disabled={candidates.length === 0}
              className="w-full"
              triggerClassName="w-full"
            />
          )}
          {!candidatesLoading && candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible admin users found. Create an admin user with RBAC roles first.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state-head-state-code">State code</Label>
          <Input
            id="state-head-state-code"
            value={form.state_code}
            onChange={(event) =>
              setForm((current) => ({ ...current, state_code: event.target.value.toUpperCase() }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state-head-state-name">State name</Label>
          <Input
            id="state-head-state-name"
            value={form.state_name}
            onChange={(event) => setForm((current) => ({ ...current, state_name: event.target.value }))}
          />
        </div>
      </div>
    </AdminFormDialog>
  );
}
