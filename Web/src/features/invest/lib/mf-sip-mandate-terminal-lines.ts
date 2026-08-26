import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { copy } from "@/shared/config/copy";

type ResolveSipMandateTerminalLinesArgs = {
  phase: MfPaymentJourneyPhase;
  abandonChecked: boolean;
  returnedFromMandate: boolean;
  nextAction?: string | null;
  status?: string | null;
};

export function resolveSipMandateTerminalLines(args: ResolveSipMandateTerminalLinesArgs): string[] {
  const terminal = copy.mutualFunds;
  const lines: string[] = [terminal.sipMandateTerminalInit];

  if (!args.abandonChecked) {
    if (args.returnedFromMandate) {
      lines.push(terminal.sipMandateTerminalConfirm);
    }
    return lines;
  }

  if (args.phase === "processing") {
    lines.push(terminal.sipMandateTerminalProcessing);
    return lines;
  }

  lines.push(terminal.sipMandateTerminalProcessing);

  if (args.returnedFromMandate) {
    lines.push(terminal.sipMandateTerminalConfirm);
    return lines;
  }

  if (args.nextAction === "pay_first_installment") {
    lines.push(terminal.sipMandateTerminalPolling);
    return lines;
  }

  if (args.nextAction === "authorize_mandate") {
    lines.push(terminal.sipMandateTerminalCreating);
    lines.push(terminal.sipMandateTerminalReady);
    return lines;
  }

  if (args.nextAction === "wait_mandate" || args.status === "PENDING") {
    lines.push(terminal.sipMandateTerminalCreating);
    return lines;
  }

  lines.push(terminal.sipMandateTerminalPolling);
  return lines;
}
