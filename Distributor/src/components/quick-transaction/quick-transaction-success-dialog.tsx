"use client";

import { Ban, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { formatAum } from "@/lib/format";
import type { QuickTxnSuccessState } from "@/lib/quick-transaction-success";

type QuickTransactionSuccessDialogProps = {
  open: boolean;
  state: QuickTxnSuccessState | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function QuickTransactionSuccessDialog({
  open,
  state,
  onOpenChange,
  onDone,
}: QuickTransactionSuccessDialogProps) {
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
          <DialogTitle className="quick-txn-success-dialog__title">Transaction submitted</DialogTitle>
          <DialogDescription className="quick-txn-success-dialog__desc">
            {state.requestRef} was sent to {state.clientCode} for investor confirmation. They can approve or
            reject it from their app.
          </DialogDescription>
        </div>
        <div className="quick-txn-success-dialog__body">
          <div className="quick-txn-success-dialog__amount">
            <p className="quick-txn-success-dialog__amount-label">
              {state.txnType === "sip" ? "SIP amount" : "Investment amount"}
            </p>
            <p className="quick-txn-success-dialog__amount-value">{formatAum(state.amount)}</p>
          </div>
          <dl className="quick-txn-success-dialog__summary">
            <div className="quick-txn-success-dialog__row">
              <dt>Request ref</dt>
              <dd className="quick-txn-success-dialog__row-value--mono">{state.requestRef}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>Type</dt>
              <dd>{state.txnType === "sip" ? "SIP" : "One time"}</dd>
            </div>
            {state.txnType === "sip" && state.sipInstallments.trim() ? (
              <div className="quick-txn-success-dialog__row">
                <dt>Installments</dt>
                <dd>{state.sipInstallments.trim()}</dd>
              </div>
            ) : null}
            <div className="quick-txn-success-dialog__row">
              <dt>Investor</dt>
              <dd className="quick-txn-success-dialog__row-value--mono">{state.clientCode}</dd>
            </div>
            <div className="quick-txn-success-dialog__row">
              <dt>Fund</dt>
              <dd>{state.fundName}</dd>
            </div>
            {state.irn ? (
              <div className="quick-txn-success-dialog__row">
                <dt>IRN</dt>
                <dd className="quick-txn-success-dialog__row-value--mono">{state.irn}</dd>
              </div>
            ) : null}
            {state.paymentMethodLabel ? (
              <div className="quick-txn-success-dialog__row">
                <dt>Payment</dt>
                <dd>{state.paymentMethodLabel}</dd>
              </div>
            ) : null}
            <div className="quick-txn-success-dialog__row">
              <dt>Status</dt>
              <dd>Pending investor confirmation</dd>
            </div>
          </dl>
          <p className="quick-txn-success-dialog__demo">
            <Ban className="quick-txn-success-dialog__demo-icon size-3.5" strokeWidth={2.25} aria-hidden />
            Demo environment — no real orders were placed.
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

export function QuickTransactionSuccessDialogHost() {
  const { quickTxnSuccess, dismissQuickTxnSuccess } = useDistributorTxnRequests();

  return (
    <QuickTransactionSuccessDialog
      open={Boolean(quickTxnSuccess)}
      state={quickTxnSuccess}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismissQuickTxnSuccess();
        }
      }}
      onDone={dismissQuickTxnSuccess}
    />
  );
}
