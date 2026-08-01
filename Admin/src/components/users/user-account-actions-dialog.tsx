"use client";

import { AlertTriangle, UserCheck, UserX } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogHeader,
} from "@/components/ui/admin-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUserSummary } from "@/lib/admin-api";

const SUSPEND_REASONS = [
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "kyc_mismatch", label: "KYC mismatch" },
  { value: "user_requested", label: "User requested" },
  { value: "compliance_hold", label: "Compliance hold" },
  { value: "repeated_auth_failures", label: "Repeated auth failures" },
  { value: "chargeback_dispute", label: "Chargeback dispute" },
] as const;

function suspendReasonLabel(value: string) {
  return SUSPEND_REASONS.find((reason) => reason.value === value)?.label ?? value.replaceAll("_", " ");
}

type UserAccountActionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: AdminUserSummary;
  suspendReason: string;
  suspendNotes: string;
  actionLoading: string | null;
  onSuspendReasonChange: (value: string) => void;
  onSuspendNotesChange: (value: string) => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
};

export function UserAccountActionsDialog({
  open,
  onOpenChange,
  summary,
  suspendReason,
  suspendNotes,
  actionLoading,
  onSuspendReasonChange,
  onSuspendNotesChange,
  onSuspend,
  onUnsuspend,
}: UserAccountActionsDialogProps) {
  const isSuspended = summary.status === "suspended";

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="md">
        <AdminDialogHeader
          title="Account actions"
          description="Suspend or reactivate this account."
          icon={UserX}
          iconTone={isSuspended ? "warning" : "destructive"}
        />
        <AdminDialogBody className="space-y-4 pt-0">
          {isSuspended ? (
            <>
              <AdminFeedbackMessage variant="warning" title="Account suspended" className="px-4 py-3">
                {summary.suspended_at ? (
                  <>
                    This user cannot sign in or transact until the account is reactivated. Suspended
                    on{" "}
                    {new Date(summary.suspended_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {summary.suspension_reason_code
                      ? ` · ${suspendReasonLabel(summary.suspension_reason_code)}`
                      : ""}
                  </>
                ) : (
                  "This user cannot sign in or transact until the account is reactivated."
                )}
              </AdminFeedbackMessage>
              <div className="flex justify-end border-t border-border pt-4">
                <Button disabled={actionLoading === "unsuspend"} onClick={onUnsuspend}>
                  <UserCheck className="size-4" />
                  {actionLoading === "unsuspend" ? "Submitting..." : "Reactivate account"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-destructive/20 bg-destructive/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-compact font-medium text-foreground">High-impact action</p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    Suspending blocks sign-in, investments, and withdrawals. Changes may require
                    compliance approval.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="suspend-reason">Suspension reason</Label>
                  <Select
                    value={suspendReason}
                    onValueChange={(value) =>
                      onSuspendReasonChange(value ?? "suspicious_activity")
                    }
                  >
                    <SelectTrigger id="suspend-reason" className="w-full">
                      <SelectValue placeholder="Select a reason">
                        {suspendReasonLabel(suspendReason)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SUSPEND_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suspend-notes">Internal notes</Label>
                  <textarea
                    id="suspend-notes"
                    rows={4}
                    placeholder="Optional context for the compliance team"
                    value={suspendNotes}
                    onChange={(event) => onSuspendNotesChange(event.target.value)}
                    className="flex min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-compact text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-caption text-muted-foreground">
                  Selected reason:{" "}
                  <span className="font-medium text-foreground">
                    {suspendReasonLabel(suspendReason)}
                  </span>
                </p>
                <Button
                  variant="destructive"
                  disabled={actionLoading === "suspend"}
                  onClick={onSuspend}
                >
                  <UserX className="size-4" />
                  {actionLoading === "suspend" ? "Submitting..." : "Suspend account"}
                </Button>
              </div>
            </>
          )}
        </AdminDialogBody>
      </AdminDialogContent>
    </AdminDialog>
  );
}

export { SUSPEND_REASONS };
