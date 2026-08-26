"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/distributor-branch-distributor-profile-data";
import {
  getLeaveRequestStatusLabel,
  type DistributorLeaveBalance,
  type DistributorLeaveRequest,
  type DistributorLeaveRequestStatus,
} from "@/lib/distributor-job-dashboard-data";
import { formatDistributorDate } from "@/lib/format";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

function leaveStatusVariant(status: DistributorLeaveRequestStatus): StatusBadgeVariant {
  if (status === "Approved") return "success";
  if (status === "Pending") return "warning";
  if (status === "Rejected") return "destructive";
  return "neutral";
}

type BranchDistributorLeaveReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BranchDistributorProfile;
  request: DistributorLeaveRequest | null;
  balances: DistributorLeaveBalance[];
  onReview: (
    requestId: string,
    decision: "Approved" | "Rejected",
    reviewNote: string,
  ) => void;
};

export function BranchDistributorLeaveReviewDialog({
  open,
  onOpenChange,
  profile,
  request,
  balances,
  onReview,
}: BranchDistributorLeaveReviewDialogProps) {
  const [reviewNote, setReviewNote] = useState("");
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);

  const remainingForType = useMemo(
    () => balances.find((balance) => balance.type === request?.type)?.remaining ?? 0,
    [balances, request?.type],
  );

  useEffect(() => {
    if (!open) {
      setReviewNote("");
      setDecisionMessage(null);
      return;
    }
    setReviewNote(request?.reviewNote ?? "");
    setDecisionMessage(null);
  }, [open, request?.id, request?.reviewNote]);

  if (!request) return null;

  const isPending = request.status === "Pending";

  const handleDecision = (decision: "Approved" | "Rejected") => {
    const note =
      reviewNote.trim() ||
      (decision === "Approved" ? "Approved by branch manager" : "Declined by branch manager");
    onReview(request.id, decision, note);
    setDecisionMessage(
      decision === "Approved"
        ? `Leave request approved for ${profile.name}.`
        : `Leave request declined for ${profile.name}.`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Review leave request</DialogTitle>
        <DialogDescription>{ZYND_MITRA_COPY.leaveApplicationDesc}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="distributor-apply-leave-dialog">
          <div className="distributor-apply-leave-dialog__header">
            <DialogTitle className="distributor-apply-leave-dialog__title">
              Review leave request
            </DialogTitle>
            <DialogDescription className="distributor-apply-leave-dialog__description">
              {profile.name} · {request.type} leave · {request.days} day{request.days === 1 ? "" : "s"}
            </DialogDescription>
          </div>

          <div className="distributor-apply-leave-dialog__fields">
            <dl className="grid gap-2 text-compact">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge variant={leaveStatusVariant(request.status)}>
                    {getLeaveRequestStatusLabel(request.status)}
                  </StatusBadge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Dates</dt>
                <dd className="font-medium tabular-nums">
                  {formatDistributorDate(request.fromDate)} – {formatDistributorDate(request.toDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Applied on</dt>
                <dd className="tabular-nums">{formatDistributorDate(request.appliedAt)}</dd>
              </div>
              {request.type !== "Unpaid" ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Balance remaining</dt>
                  <dd className="font-medium tabular-nums">
                    {remainingForType} day{remainingForType === 1 ? "" : "s"}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="distributor-apply-leave-dialog__field">
              <Label>Reason submitted</Label>
              <p className="rounded-[var(--radius-control)] border border-border bg-muted/30 px-3 py-2 text-compact text-foreground">
                {request.reason}
              </p>
            </div>

            <div className="distributor-apply-leave-dialog__field">
              <Label htmlFor="leave-review-note">Manager note</Label>
              <textarea
                id="leave-review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder={
                  isPending ? ZYND_MITRA_COPY.assignNotePlaceholder : "Review note on file"
                }
                rows={3}
                readOnly={!isPending || decisionMessage !== null}
                className={cn(
                  "min-h-[4.5rem] w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-compact dark:bg-input/30",
                  (!isPending || decisionMessage !== null) && "bg-muted/20 text-muted-foreground",
                )}
              />
            </div>

            {decisionMessage ? (
              <p className="distributor-apply-leave-dialog__hint" role="status">
                {decisionMessage}
              </p>
            ) : null}

            {request.reviewedAt && !isPending ? (
              <p className="text-caption text-muted-foreground">
                Reviewed {formatDistributorDate(request.reviewedAt)}
              </p>
            ) : null}
          </div>

          <div className="distributor-apply-leave-dialog__actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {isPending && !decisionMessage ? (
              <>
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  onClick={() => handleDecision("Rejected")}
                >
                  Decline
                </DistributorActionButton>
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  onClick={() => handleDecision("Approved")}
                >
                  Approve
                </DistributorActionButton>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
