"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminDialogFooter } from "@/components/ui/admin-dialog";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  createAdminHierarchyBranch,
  fetchAdminHierarchyOverview,
  type CreateAdminBranchPayload,
} from "@/lib/admin-distributor-hierarchy-api";
import { isMitraStateHeadOnly } from "@/lib/admin-mitra-roles";
import { fetchAdminPincodeLookup } from "@/lib/admin-master-data-api";
import { getErrorMessage } from "@/lib/errors";

type BranchFormState = CreateAdminBranchPayload;

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
  const { roleKeys } = useAdminAuth();
  const isStateHeadOnly = isMitraStateHeadOnly(roleKeys);
  const [form, setForm] = useState<BranchFormState>({
    name: "",
    city: "",
    state_code: "",
    state_name: "",
  });
  const [lockedState, setLockedState] = useState<{ state_code: string; state_name: string } | null>(
    null,
  );
  const [pincode, setPincode] = useState("");
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [locationResolved, setLocationResolved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lastResolvedPincodeRef = useRef("");

  useEffect(() => {
    if (!open) return;

    setForm({
      name: "",
      city: "",
      state_code: "",
      state_name: "",
    });
    setLockedState(null);
    setPincode("");
    setPincodeError("");
    setLocationResolved(false);
    lastResolvedPincodeRef.current = "";
    setError("");

    if (!isStateHeadOnly) return;

    void fetchAdminHierarchyOverview()
      .then((overview) => {
        if (overview.state_assigned && overview.state_code && overview.state_name) {
          setLockedState({
            state_code: overview.state_code,
            state_name: overview.state_name,
          });
        }
      })
      .catch(() => setLockedState(null));
  }, [isStateHeadOnly, open]);

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
        const resolvedStateCode = result.state_code.trim().toUpperCase();
        if (
          lockedState &&
          resolvedStateCode !== lockedState.state_code.trim().toUpperCase()
        ) {
          setPincodeError(
            `This PIN code is outside ${lockedState.state_name} (${lockedState.state_code}). Branches must be opened in your assigned state.`,
          );
          lastResolvedPincodeRef.current = "";
          return;
        }

        lastResolvedPincodeRef.current = nextPincode;
        setLocationResolved(true);
        setForm((current) => ({
          ...current,
          city: result.city,
          state_code: lockedState?.state_code ?? result.state_code,
          state_name: lockedState?.state_name ?? result.state_name,
        }));
      } catch (err) {
        lastResolvedPincodeRef.current = "";
        setPincodeError(getErrorMessage(err, "Could not look up this PIN code."));
      } finally {
        setPincodeLoading(false);
      }
    },
    [lockedState],
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
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit branch opening request."));
    } finally {
      setLoading(false);
    }
  }, [form, onCreated, onOpenChange]);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add branch"
      description={
        lockedState
          ? `Submit a branch opening request in ${lockedState.state_name} (${lockedState.state_code}) for Super Head approval.`
          : "Submit a branch opening request for Super Head approval. You can assign a manager after it is approved."
      }
      icon={Building2}
      footer={
        <AdminDialogFooter>
          <AdminDialogFooterActions
            cancelLabel="Cancel"
            confirmLabel="Submit for approval"
            loading={loading}
            confirmDisabled={
              !form.name.trim() ||
              !PINCODE_PATTERN.test(pincode) ||
              !locationResolved ||
              !form.city.trim() ||
              !form.state_code.trim() ||
              !form.state_name.trim() ||
              pincodeLoading ||
              Boolean(pincodeError)
            }
            onCancel={() => onOpenChange(false)}
            onConfirm={() => void handleSubmit()}
          />
        </AdminDialogFooter>
      }
    >
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {lockedState ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>Assigned state</Label>
            <Input
              value={`${lockedState.state_name} (${lockedState.state_code})`}
              readOnly
              disabled
            />
          </div>
        ) : null}

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
              placeholder="462001"
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
          {!pincodeError && lockedState ? (
            <p className="text-sm text-muted-foreground">
              PIN code must resolve to {lockedState.state_name} ({lockedState.state_code}).
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch-city">City</Label>
          <Input id="branch-city" value={form.city} placeholder="Resolved from PIN code" readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch-state">State</Label>
          <Input
            id="branch-state"
            value={
              form.state_name && form.state_code ? `${form.state_name} (${form.state_code})` : ""
            }
            placeholder="Resolved from PIN code"
            readOnly
            disabled
          />
        </div>
      </div>
    </AdminFormDialog>
  );
}
