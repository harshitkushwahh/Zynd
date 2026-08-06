"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminHierarchyBranch,
  fetchAdminHierarchyBranchManagerCandidates,
  type AdminHierarchyBranchManagerCandidate,
  type CreateAdminBranchPayload,
} from "@/lib/admin-distributor-hierarchy-api";
import { fetchAdminPincodeLookup } from "@/lib/admin-master-data-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type BranchFormState = Omit<CreateAdminBranchPayload, "manager_user_id"> & {
  manager_user_id: string;
};

type DistributorHeadAddBranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const PINCODE_PATTERN = /^\d{6}$/;

export function DistributorHeadAddBranchDialog({
  open,
  onOpenChange,
  onCreated,
}: DistributorHeadAddBranchDialogProps) {
  const [form, setForm] = useState<BranchFormState>({
    name: "",
    city: "",
    state_code: "",
    state_name: "",
    manager_user_id: "",
  });
  const [pincode, setPincode] = useState("");
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [locationResolved, setLocationResolved] = useState(false);
  const [candidates, setCandidates] = useState<AdminHierarchyBranchManagerCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [managerSelectOpen, setManagerSelectOpen] = useState(false);
  const lastResolvedPincodeRef = useRef("");

  useEffect(() => {
    if (!open) {
      setManagerSelectOpen(false);
      return;
    }

    setForm({
      name: "",
      city: "",
      state_code: "",
      state_name: "",
      manager_user_id: "",
    });
    setPincode("");
    setPincodeError("");
    setLocationResolved(false);
    lastResolvedPincodeRef.current = "";
    setError("");
    setCandidatesLoading(true);

    void fetchAdminHierarchyBranchManagerCandidates()
      .then((items) => {
        setCandidates(items);
        if (items.length === 1) {
          setForm((current) => ({ ...current, manager_user_id: items[0]?.user_id ?? "" }));
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
        value: candidate.user_id,
        label: `${candidate.name} · ${candidate.email}`,
      })),
    [candidates],
  );

  const applyPincodeLookup = useCallback(
    async (nextPincode: string) => {
      if (!PINCODE_PATTERN.test(nextPincode)) {
        setPincodeError("Enter a valid 6-digit PIN code.");
        setLocationResolved(false);
        setForm((current) => ({
          ...current,
          city: "",
          state_code: "",
          state_name: "",
        }));
        return;
      }

      if (lastResolvedPincodeRef.current === nextPincode) {
        return;
      }

      setPincodeLoading(true);
      setPincodeError("");
      setLocationResolved(false);
      setForm((current) => ({
        ...current,
        city: "",
        state_code: "",
        state_name: "",
      }));

      try {
        const result = await fetchAdminPincodeLookup(nextPincode);
        lastResolvedPincodeRef.current = nextPincode;
        setLocationResolved(true);
        setForm((current) => ({
          ...current,
          city: result.city,
          state_code: result.state_code,
          state_name: result.state_name,
        }));
      } catch (err) {
        lastResolvedPincodeRef.current = "";
        setPincodeError(getErrorMessage(err, "Could not look up this PIN code."));
      } finally {
        setPincodeLoading(false);
      }
    },
    [],
  );

  const handlePincodeChange = (value: string) => {
    const normalized = value.replace(/\D/g, "").slice(0, 6);
    setPincode(normalized);
    setPincodeError("");
    setLocationResolved(false);
    lastResolvedPincodeRef.current = "";
    setForm((current) => ({
      ...current,
      city: "",
      state_code: "",
      state_name: "",
    }));

    if (normalized.length === 6) {
      void applyPincodeLookup(normalized);
    }
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await createAdminHierarchyBranch({
        name: form.name.trim(),
        city: form.city?.trim() || undefined,
        state_code: form.state_code.trim().toUpperCase(),
        state_name: form.state_name.trim(),
        manager_user_id: form.manager_user_id,
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create branch."));
    } finally {
      setLoading(false);
    }
  }, [form, onCreated, onOpenChange]);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add branch"
      description="Create a branch and assign a branch manager admin user."
      icon={Building2}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Create branch"
            loading={loading}
            confirmDisabled={
              !form.name.trim() ||
              !PINCODE_PATTERN.test(pincode) ||
              !locationResolved ||
              !form.city.trim() ||
              !form.state_code.trim() ||
              !form.state_name.trim() ||
              !form.manager_user_id ||
              candidatesLoading ||
              pincodeLoading
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
          <Label htmlFor="branch-name">Branch name</Label>
          <Input
            id="branch-name"
            placeholder="Pune West"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="branch-pincode">PIN code</Label>
          <div className="relative">
            <Input
              id="branch-pincode"
              inputMode="numeric"
              maxLength={6}
              placeholder="560102"
              value={pincode}
              className="font-mono"
              onChange={(event) => handlePincodeChange(event.target.value)}
              onBlur={() => {
                if (pincode.length === 6) {
                  void applyPincodeLookup(pincode);
                }
              }}
            />
            {pincodeLoading ? (
              <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {pincodeError ? <p className="text-sm text-destructive">{pincodeError}</p> : null}
          {!pincodeError && !locationResolved && pincode.length > 0 && pincode.length < 6 ? (
            <p className="text-sm text-muted-foreground">Enter all 6 digits to load city and state.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch-city">City</Label>
          <Input
            id="branch-city"
            value={form.city}
            placeholder="Resolved from PIN code"
            readOnly
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-state">State</Label>
          <Input
            id="branch-state"
            value={
              form.state_name && form.state_code
                ? `${form.state_name} (${form.state_code})`
                : ""
            }
            placeholder="Resolved from PIN code"
            readOnly
            disabled
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="branch-manager">{MITRA_HIERARCHY_COPY.branchManager}</Label>
          {candidatesLoading ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading {MITRA_HIERARCHY_COPY.branchManager.toLowerCase()} options…
            </div>
          ) : (
            <AdminSelect
              value={form.manager_user_id}
              open={managerSelectOpen}
              onOpenChange={setManagerSelectOpen}
              size="default"
              onValueChange={(value) => setForm((current) => ({ ...current, manager_user_id: value }))}
              options={managerOptions}
              placeholder={`Select ${MITRA_HIERARCHY_COPY.branchManager.toLowerCase()}`}
              disabled={candidates.length === 0}
              className="w-full"
              triggerClassName="w-full"
            />
          )}
        </div>
      </div>
    </AdminFormDialog>
  );
}
