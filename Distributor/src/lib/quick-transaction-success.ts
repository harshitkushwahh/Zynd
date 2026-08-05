import type { QuickTxnType } from "@/lib/quick-transaction-types";

export type QuickTxnSuccessState = {
  txnType: QuickTxnType;
  amount: number;
  sipInstallments: string;
  clientCode: string;
  investorEmailMasked: string;
  fundName: string;
  irn: string;
  paymentMethodLabel: string;
  requestRef: string;
};
