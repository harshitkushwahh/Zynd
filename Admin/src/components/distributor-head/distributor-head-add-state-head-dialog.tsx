"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Label } from "@/components/ui/label";
import { pickUserRef } from "@/lib/admin-user-ref";
import {
  createAdminHierarchyStateHead,
  fetchAdminHierarchyStateHeadCandidates,
  fetchAdminHierarchyStateHeads,
  type AdminHierarchyStateHeadCandidate,
  type CreateAdminStateHeadPayload,
} from "@/lib/admin-distributor-hierarchy-api";
import { fetchAdminStates, type AdminState } from "@/lib/admin-master-data-api";
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

function resolveDefaultState(
  states: AdminState[],
  defaultStateCode: string,
): StateHeadFormState {
  const preferred =
    states.find((state) => state.state_code === defaultStateCode) ?? states[0];
  return {
    user_ref: "",
    state_code: preferred?.state_code ?? "",
    state_name: preferred?.state_name ?? "",
  };
}

export function DistributorHeadAddStateHeadDialog({
  open,
  onOpenChange,
  defaultStateCode = "MH",
  defaultStateName: _defaultStateName = "Maharashtra",
  onCreated,
}: DistributorHeadAddStateHeadDialogProps) {
  const [form, setForm] = useState<StateHeadFormState>({
    user_ref: "",
    state_code: defaultStateCode,
    state_name: "",
  });
  const [candidates, setCandidates] = useState<AdminHierarchyStateHeadCandidate[]>([]);
  const [states, setStates] = useState<AdminState[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [statesLoading, setStatesLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userSelectOpen, setUserSelectOpen] = useState(false);
  const [stateSelectOpen, setStateSelectOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setUserSelectOpen(false);
      setStateSelectOpen(false);
      return;
    }

    setForm({
      user_ref: "",
      state_code: defaultStateCode,
      state_name: "",
    });
    setError("");
    setCandidatesLoading(true);
    setStatesLoading(true);

    void Promise.all([
      fetchAdminHierarchyStateHeadCandidates(),
      fetchAdminStates(),
      fetchAdminHierarchyStateHeads(),
    ])
      .then(([candidateItems, stateItems, assignedStateHeads]) => {
        const assignedCodes = new Set(assignedStateHeads.map((row) => row.state_code));
        const availableStates = stateItems.filter((state) => !assignedCodes.has(state.state_code));
        setCandidates(candidateItems);
        setStates(availableStates);
        setForm((current) => ({
          ...resolveDefaultState(availableStates, defaultStateCode),
          user_ref: candidateItems.length === 1 ? pickUserRef(candidateItems[0] ?? {}) : current.user_ref,
        }));
      })
      .catch((err) => {
        setCandidates([]);
        setStates([]);
        setError(getErrorMessage(err, "Could not load assignment options."));
      })
      .finally(() => {
        setCandidatesLoading(false);
        setStatesLoading(false);
      });
  }, [defaultStateCode, open]);

  const userOptions = useMemo<AdminSelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: pickUserRef(candidate),
        label: `${candidate.name} · ${candidate.email}`,
      })),
    [candidates],
  );

  const stateOptions = useMemo<AdminSelectOption[]>(
    () =>
      states.map((state) => ({
        value: state.state_code,
        label: `${state.state_name} (${state.state_code})`,
      })),
    [states],
  );

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await createAdminHierarchyStateHead({
        user_ref: form.user_ref,
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

  const optionsLoading = candidatesLoading || statesLoading;

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
              !form.user_ref ||
              !form.state_code.trim() ||
              !form.state_name.trim() ||
              optionsLoading
            }
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="state-head-user">Admin user</Label>
          {candidatesLoading ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading admin users…
            </div>
          ) : (
            <AdminSelect
              value={form.user_ref}
              open={userSelectOpen}
              onOpenChange={setUserSelectOpen}
              size="default"
              onValueChange={(value) => setForm((current) => ({ ...current, user_ref: value }))}
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
          <Label htmlFor="state-head-state">State</Label>
          {statesLoading ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading states…
            </div>
          ) : (
            <AdminSelect
              value={form.state_code}
              open={stateSelectOpen}
              onOpenChange={setStateSelectOpen}
              size="default"
              onValueChange={(value) => {
                const selected = states.find((state) => state.state_code === value);
                setForm((current) => ({
                  ...current,
                  state_code: value,
                  state_name: selected?.state_name ?? "",
                }));
              }}
              options={stateOptions}
              placeholder="Select state"
              disabled={states.length === 0}
              className="w-full"
              triggerClassName="w-full"
            />
          )}
          {!statesLoading && states.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All states already have a {MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} assigned.
            </p>
          ) : null}
        </div>
      </div>
    </AdminFormDialog>
  );
}
