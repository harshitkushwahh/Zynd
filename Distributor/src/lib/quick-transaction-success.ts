import type { QuickTxnType } from "@/lib/quick-transaction-types";

export type QuickTxnSuccessFundLine = {
  fundName: string;
  irn: string;
  amount: number;
  amcLogoUrl?: string | null;
  amcSlug?: string | null;
  logoMark?: string;
};

export type QuickTxnSuccessState = {
  txnType: QuickTxnType;
  amount: number;
  fundCount: number;
  fundLines: QuickTxnSuccessFundLine[];
  sipInstallments: string;
  clientCode: string;
  investorEmailMasked: string;
  fundName: string;
  irn: string;
  paymentMethodLabel: string;
  requestRef: string;
  recommendationLink?: string;
  recommendationToken?: string;
};
