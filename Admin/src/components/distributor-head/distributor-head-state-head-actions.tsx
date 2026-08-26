"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  UserMinus,
} from "lucide-react";

import { AdminCenteredConfirmDialog } from "@/components/ui/admin-centered-confirm-dialog";
import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  fetchAdminHierarchyStateHeadCandidates,
  pauseAdminHierarchyStateHead,
  replaceAdminHierarchyStateHead,
  resumeAdminHierarchyStateHead,
  unassignAdminHierarchyStateHead,
  type AdminHierarchyStateHead,
  type AdminHierarchyStateHeadCandidate,
} from "@/lib/admin-distributor-hierarchy-api";
import { pickUserRef } from "@/lib/admin-user-ref";
import { distributorHeadStateHeadHref } from "@/lib/admin-distributor-head-state-head-navigation";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { getErrorMessage } from "@/lib/errors";

type ConfirmKind = "pause" | "resume" | "unassign" | null;

type DistributorHeadStateHeadActionsProps = {
  stateHead: AdminHierarchyStateHead;
  onUpdated: (next: AdminHierarchyStateHead) => void;
  onUnassigned: (stateCode: string, stateName: string) => void;
};

export function DistributorHeadStateHeadActions({
  stateHead,
  onUpdated,
  onUnassigned,
}: DistributorHeadStateHeadActionsProps) {
  const router = useRouter();
  const isPaused = stateHead.status === "paused";
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<AdminHierarchyStateHeadCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [replacementUserId, setReplacementUserId] = useState("");

  useEffect(() => {
    if (!replaceOpen) return;
    setError("");
    setReplacementUserId("");
    setCandidatesLoading(true);
    void fetchAdminHierarchyStateHeadCandidates()
      .then((items) => {
        setCandidates(items);
        if (items.length === 1) setReplacementUserId(pickUserRef(items[0] ?? {}));
      })
      .catch((err) => {
        setCandidates([]);
        setError(getErrorMessage(err, "Could not load replacement candidates."));
      })
      .finally(() => setCandidatesLoading(false));
  }, [replaceOpen]);

  const candidateOptions: AdminSelectOption[] = candidates.map((row) => ({
    value: pickUserRef(row),
    label: `${row.name} · ${row.email}`,
  }));

  const stateHeadRef = pickUserRef(stateHead);

  const runConfirm = async () => {
    if (!confirmKind) return;
    setLoading(true);
    setError("");
    try {
      if (confirmKind === "pause") {
        const result = await pauseAdminHierarchyStateHead(stateHeadRef);
        onUpdated({ ...stateHead, ...result.state_head });
      } else if (confirmKind === "resume") {
        const result = await resumeAdminHierarchyStateHead(stateHeadRef);
        onUpdated({ ...stateHead, ...result.state_head });
      } else {
        const result = await unassignAdminHierarchyStateHead(stateHeadRef);
        onUnassigned(result.result.state_code, result.result.state_name);
        router.replace("/dashboard/distributor-head/state-heads");
      }
      setConfirmKind(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not update Mitra State Head."));
    } finally {
      setLoading(false);
    }
  };

  const runReplace = async () => {
    if (!replacementUserId) return;
    setLoading(true);
    setError("");
    try {
      const result = await replaceAdminHierarchyStateHead(stateHeadRef, replacementUserId);
      setReplaceOpen(false);
      onUpdated(result.state_head);
      router.replace(distributorHeadStateHeadHref(pickUserRef(result.state_head)));
    } catch (err) {
      setError(getErrorMessage(err, "Could not change Mitra State Head."));
    } finally {
      setLoading(false);
    }
  };

  const confirmTitle =
    confirmKind === "pause"
      ? `Pause ${MITRA_HIERARCHY_COPY.stateHead}?`
      : confirmKind === "resume"
        ? `Resume ${MITRA_HIERARCHY_COPY.stateHead}?`
        : `Remove ${MITRA_HIERARCHY_COPY.stateHead}?`;

  const confirmDescription =
    confirmKind === "pause"
      ? `${stateHead.name} will keep this state assignment but cannot manage ${stateHead.state_name} until you resume work.`
      : confirmKind === "resume"
        ? `${stateHead.name} will regain Mitra State Head access for ${stateHead.state_name} (${stateHead.state_code}).`
        : `Remove ${stateHead.name} as ${MITRA_HIERARCHY_COPY.stateHead} for ${stateHead.state_name}? Branch managers and ${MITRA_HIERARCHY_COPY.zyndMitras.toLowerCase()} stay under the state and will show as unassigned until you assign someone else. This does not delete the account.`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              aria-label={`${MITRA_HIERARCHY_COPY.stateHead} actions`}
            >
              <MoreHorizontal className="size-4" />
              Manage
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-52">
          {isPaused ? (
            <DropdownMenuItem onClick={() => setConfirmKind("resume")}>
              <PlayCircle className="size-4" />
              Resume work
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirmKind("pause")}>
              <PauseCircle className="size-4" />
              Pause work
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setReplaceOpen(true)}>
            <ArrowLeftRight className="size-4" />
            Switch State Head
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmKind("unassign")}>
            <UserMinus className="size-4" />
            Remove assignment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AdminCenteredConfirmDialog
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setConfirmKind(null);
            setError("");
          }
        }}
        title={confirmTitle}
        description={
          error
            ? `${confirmDescription}\n\n${error}`
            : confirmDescription
        }
        icon={
          confirmKind === "unassign"
            ? UserMinus
            : confirmKind === "resume"
              ? PlayCircle
              : PauseCircle
        }
        iconTone={confirmKind === "unassign" ? "destructive" : "warning"}
        confirmLabel={
          confirmKind === "pause"
            ? "Pause work"
            : confirmKind === "resume"
              ? "Resume work"
              : "Remove assignment"
        }
        confirmVariant={confirmKind === "unassign" ? "destructive" : "default"}
        loading={loading}
        onConfirm={() => void runConfirm()}
      />

      <AdminFormDialog
        open={replaceOpen}
        onOpenChange={(open) => {
          if (loading) return;
          setReplaceOpen(open);
          if (!open) setError("");
        }}
        title="Switch State Head"
        description={`Replace ${stateHead.name} for ${stateHead.state_name} (${stateHead.state_code}). Network reporting stays under this state.`}
        icon={ArrowLeftRight}
        size="md"
        footer={
          <AdminDialogFooterActions
            onCancel={() => setReplaceOpen(false)}
            onConfirm={() => void runReplace()}
            confirmLabel="Switch State Head"
            loading={loading}
            confirmDisabled={!replacementUserId || candidatesLoading}
          />
        }
      >
        <div className="space-y-4">
          {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
          <div className="space-y-2">
            <Label htmlFor="replace-state-head-user">New admin user</Label>
            {candidatesLoading ? (
              <div className="flex items-center gap-2 text-compact text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading candidates…
              </div>
            ) : (
              <AdminSelect
                value={replacementUserId}
                onValueChange={setReplacementUserId}
                options={candidateOptions}
                placeholder="Select admin user"
                disabled={candidates.length === 0}
              />
            )}
            {!candidatesLoading && candidates.length === 0 ? (
              <p className="text-caption text-muted-foreground">
                No eligible admin users available. Assign an admin RBAC role first.
              </p>
            ) : null}
          </div>
        </div>
      </AdminFormDialog>
    </>
  );
}
