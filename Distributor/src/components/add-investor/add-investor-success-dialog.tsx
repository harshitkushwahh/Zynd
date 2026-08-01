"use client";

import { Ban, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AddInvestorSuccessState } from "@/lib/add-investor/add-investor-success";

type AddInvestorSuccessDialogProps = {
  open: boolean;
  state: AddInvestorSuccessState | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function AddInvestorSuccessDialog({
  open,
  state,
  onOpenChange,
  onDone,
}: AddInvestorSuccessDialogProps) {
  if (!state) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="quick-txn-success-dialog max-w-md gap-0 p-0" showCloseButton={false}>
        <div className="quick-txn-success-dialog__hero">
          <span className="quick-txn-success-dialog__icon" aria-hidden>
            <Check className="size-7" strokeWidth={2.75} />
          </span>
          <DialogTitle className="quick-txn-success-dialog__title">Investor onboarded</DialogTitle>
          <DialogDescription className="quick-txn-success-dialog__desc">
            {state.clientCode} has been added to your client book and successfully onboarded to Zynd.
          </DialogDescription>
        </div>
        <div className="quick-txn-success-dialog__body">
          <div className="quick-txn-success-dialog__amount">
            <p className="quick-txn-success-dialog__amount-label">Investor</p>
            <p className="quick-txn-success-dialog__amount-value">{state.investorName}</p>
          </div>
          <dl className="quick-txn-success-dialog__summary">
            <div className="quick-txn-success-dialog__row">
              <dt>Client code</dt>
              <dd className="quick-txn-success-dialog__row-value--mono">{state.clientCode}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>Email</dt>
              <dd>{state.email}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>Mobile</dt>
              <dd>+91 {state.mobile}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>PAN</dt>
              <dd className="quick-txn-success-dialog__row-value--mono">{state.pan}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>KYC path</dt>
              <dd>{state.kycPath}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>Status</dt>
              <dd>Added to your book · Onboarded</dd>
            </div>
          </dl>
          <p className="quick-txn-success-dialog__demo">
            <Ban className="quick-txn-success-dialog__demo-icon size-3.5" strokeWidth={2.25} aria-hidden />
            Demo environment — no real investor account was created.
          </p>
          <div className="quick-txn-success-dialog__actions">
            <Button type="button" className="w-full" size="lg" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
