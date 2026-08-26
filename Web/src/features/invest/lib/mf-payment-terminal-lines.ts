import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { copy } from "@/shared/config/copy";

type ResolvePaymentTerminalLinesArgs = {
  phase: MfPaymentJourneyPhase;
  abandonChecked: boolean;
  redirecting: boolean;
  returnedFromPayment: boolean;
  nextAction?: string | null;
  fpState?: string | null;
  status?: string | null;
};

export function resolvePaymentTerminalLines(args: ResolvePaymentTerminalLinesArgs): string[] {
  const terminal = copy.mutualFunds;
  const lines: string[] = [terminal.orderPayTerminalInit];

  if (!args.abandonChecked) {
    if (args.returnedFromPayment) {
      lines.push(terminal.orderPayTerminalConfirm);
    }
    return lines;
  }

  if (args.phase === "processing") {
    lines.push(terminal.orderPayTerminalProcessing);
    return lines;
  }

  lines.push(terminal.orderPayTerminalProcessing);

  if (args.redirecting) {
    lines.push(terminal.orderPayTerminalReview);
    lines.push(terminal.orderPayTerminalRedirect);
    return lines;
  }

  if (args.returnedFromPayment) {
    lines.push(terminal.orderPayTerminalConfirm);
    return lines;
  }

  if (args.nextAction === "wait_review" || args.fpState === "under_review") {
    lines.push(terminal.orderPayTerminalReview);
    return lines;
  }

  if (args.nextAction === "wait_payment_setup" || args.status === "PAYMENT_PENDING") {
    lines.push(terminal.orderPayTerminalSetup);
    return lines;
  }

  if (args.nextAction === "pay_upi") {
    lines.push(terminal.orderPayTerminalReady);
    lines.push(terminal.orderPayTerminalRedirect);
    return lines;
  }

  lines.push(terminal.orderPayTerminalPolling);
  return lines;
}
