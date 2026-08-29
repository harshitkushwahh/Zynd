"use client";

import { useCallback, useState } from "react";
import { Ban, Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { resolveAmcLogoUrl } from "@/lib/distributor-asset-url";
import { formatAum } from "@/lib/format";
import type { QuickTxnSuccessFundLine, QuickTxnSuccessState } from "@/lib/quick-transaction-success";

type QuickTransactionSuccessDialogProps = {
  open: boolean;
  state: QuickTxnSuccessState | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function SuccessFundLogo({ line }: { line: QuickTxnSuccessFundLine }) {
  const logoUrl = resolveAmcLogoUrl(line.amcLogoUrl, line.amcSlug);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="quick-txn-success-dialog__breakdown-logo"
      />
    );
  }

  return (
    <div className="quick-txn-success-dialog__breakdown-logo quick-txn-success-dialog__breakdown-logo--fallback" aria-hidden>
      {line.logoMark ?? "MF"}
    </div>
  );
}

export function QuickTransactionSuccessDialog({
  open,
  state,
  onOpenChange,
  onDone,
}: QuickTransactionSuccessDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    if (!state?.recommendationLink) return;
    try {
      await navigator.clipboard.writeText(state.recommendationLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [state?.recommendationLink]);

  if (!state) {
    return null;
  }

  const hasLiveLink = Boolean(state.recommendationLink);
  const hasMultiFundBreakdown = state.fundLines.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="quick-txn-success-dialog !w-[min(100%-2rem,var(--quick-txn-success-dialog-width))] !max-w-[min(100%-2rem,var(--quick-txn-success-dialog-width))] !rounded-[var(--quick-txn-success-dialog-radius)] flex max-h-[min(calc(100vh-2rem),40rem)] flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="quick-txn-success-dialog__hero">
          <span className="quick-txn-success-dialog__icon" aria-hidden>
            <Check className="size-7" strokeWidth={2.75} />
          </span>
          <DialogTitle className="quick-txn-success-dialog__title">Recommendation sent</DialogTitle>
          <DialogDescription className="quick-txn-success-dialog__desc">
            {state.requestRef} was sent to {state.clientCode}. The investor can open the secure link to review and
            complete the investment from their Zynd account.
          </DialogDescription>
        </div>

        <div className="quick-txn-success-dialog__body">
          <div className="quick-txn-success-dialog__stack">
            <div className="quick-txn-success-dialog__amount">
              <p className="quick-txn-success-dialog__amount-label">
                {state.txnType === "sip" ? "Total SIP per month" : "Total investment"}
              </p>
              <p className="quick-txn-success-dialog__amount-value">{formatAum(state.amount)}</p>
            </div>

            <dl className="quick-txn-success-dialog__summary">
              <div className="quick-txn-success-dialog__row">
                <dt>Funds</dt>
                <dd>{state.fundCount}</dd>
              </div>
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
              {!hasMultiFundBreakdown ? (
                <div className="quick-txn-success-dialog__row">
                  <dt>Fund</dt>
                  <dd>{state.fundName}</dd>
                </div>
              ) : (
                <div className="quick-txn-success-dialog__row">
                  <dt>Fund</dt>
                  <dd>{state.fundCount} funds in cart</dd>
                </div>
              )}
              {!hasMultiFundBreakdown && state.irn ? (
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
                <dd>Sent · awaiting investor action</dd>
              </div>
            </dl>

            {hasMultiFundBreakdown ? (
              <div className="quick-txn-success-dialog__breakdown-panel">
                <p className="quick-txn-success-dialog__panel-title">
                  Breakdown · {state.fundCount} funds
                </p>
                <ul className="quick-txn-success-dialog__breakdown">
                  {state.fundLines.map((line) => (
                    <li key={`${line.irn}-${line.fundName}`}>
                      <SuccessFundLogo line={line} />
                      <div className="quick-txn-success-dialog__breakdown-copy">
                        <span className="quick-txn-success-dialog__breakdown-name">{line.fundName}</span>
                        <span className="quick-txn-success-dialog__breakdown-amount">{formatAum(line.amount)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasLiveLink ? (
              <div className="quick-txn-success-dialog__link-panel">
                <p className="quick-txn-success-dialog__panel-title">Investor link</p>
                <div className="quick-txn-success-dialog__link-row">
                  <code className="quick-txn-success-dialog__link-code">{state.recommendationLink}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
                    {copied ? (
                      <>
                        <Check className="size-3.5" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" aria-hidden />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="quick-txn-success-dialog__link-note">
                  The investor also receives an in-app notification. The link expires in 24 hours.
                </p>
              </div>
            ) : (
              <p className="quick-txn-success-dialog__demo">
                <Ban className="quick-txn-success-dialog__demo-icon size-3.5" strokeWidth={2.25} aria-hidden />
                Recommendation link was not returned by the server.
              </p>
            )}
          </div>
        </div>

        <div className="quick-txn-success-dialog__footer">
          <Button type="button" className="w-full" size="lg" onClick={onDone}>
            Done
          </Button>
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
