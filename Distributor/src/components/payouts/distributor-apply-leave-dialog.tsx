"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
  type DistributorLeaveBalance,
  type DistributorLeaveType,
} from "@/lib/dummy/distributor-job-dashboard";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEAVE_TYPES: DistributorLeaveType[] = ["Annual", "Sick", "Casual", "Unpaid"];

type DistributorApplyLeaveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: DistributorLeaveBalance[];
};

export function DistributorApplyLeaveDialog({
  open,
  onOpenChange,
  balances,
}: DistributorApplyLeaveDialogProps) {
  const [leaveType, setLeaveType] = useState<DistributorLeaveType>("Annual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const remainingForType = useMemo(
    () => balances.find((balance) => balance.type === leaveType)?.remaining ?? 0,
    [balances, leaveType],
  );

  const resetForm = () => {
    setLeaveType("Annual");
    setFromDate("");
    setToDate("");
    setReason("");
    setSubmitted(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Apply for leave</DialogTitle>
        <DialogDescription>Submit a leave request for branch manager approval</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <form className="distributor-apply-leave-dialog" onSubmit={handleSubmit}>
          <div className="distributor-apply-leave-dialog__header">
            <DialogTitle className="distributor-apply-leave-dialog__title">Apply for leave</DialogTitle>
            <DialogDescription className="distributor-apply-leave-dialog__description">
              Your branch manager will review and approve the request.
            </DialogDescription>
          </div>

          {submitted ? (
            <p className="distributor-apply-leave-dialog__hint" role="status">
              Leave request submitted for demo. Approval workflow is not connected yet.
            </p>
          ) : (
            <div className="distributor-apply-leave-dialog__fields">
              <div className="distributor-apply-leave-dialog__field">
                <Label htmlFor="leave-type">Leave type</Label>
                <Select
                  value={leaveType}
                  onValueChange={(value) => {
                    if (value) setLeaveType(value as DistributorLeaveType);
                  }}
                >
                  <SelectTrigger id="leave-type" className="w-full">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {leaveType !== "Unpaid" ? (
                  <p className="distributor-apply-leave-dialog__balance">
                    {remainingForType} day{remainingForType === 1 ? "" : "s"} remaining
                  </p>
                ) : null}
              </div>

              <div className="distributor-apply-leave-dialog__row">
                <div className="distributor-apply-leave-dialog__field">
                  <Label htmlFor="leave-from">From</Label>
                  <Input
                    id="leave-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    required
                  />
                </div>
                <div className="distributor-apply-leave-dialog__field">
                  <Label htmlFor="leave-to">To</Label>
                  <Input
                    id="leave-to"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => setToDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="distributor-apply-leave-dialog__field">
                <Label htmlFor="leave-reason">Reason</Label>
                <textarea
                  id="leave-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Brief reason for your leave"
                  rows={3}
                  required
                  className={cn(
                    "min-h-[4.5rem] w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-compact dark:bg-input/30",
                  )}
                />
              </div>
            </div>
          )}

          <div className="distributor-apply-leave-dialog__actions">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {submitted ? "Close" : "Cancel"}
            </Button>
            {!submitted ? (
              <DistributorActionButton type="submit" variant="primary">
                Submit request
              </DistributorActionButton>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
