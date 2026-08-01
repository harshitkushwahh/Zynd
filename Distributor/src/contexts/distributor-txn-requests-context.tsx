"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DUMMY_TXN_REQUESTS } from "@/lib/dummy/txn-requests";
import { createTxnRequestRef } from "@/lib/dummy/create-txn-request-ref";
import type { DistributorTxnRequest } from "@/lib/dummy/types";
import type { QuickTxnSuccessState } from "@/lib/quick-transaction-success";

export type SubmitInvestorConfirmationInput = {
  txnType: "one-time" | "sip";
  amount: number;
  sipInstallments: string;
  clientCode: string;
  investorEmailMasked: string;
  fundName: string;
  irn: string;
  paymentMethodLabel: string;
};

type DistributorTxnRequestsContextValue = {
  requests: DistributorTxnRequest[];
  quickTxnSuccess: QuickTxnSuccessState | null;
  submitForInvestorConfirmation: (input: SubmitInvestorConfirmationInput) => QuickTxnSuccessState;
  dismissQuickTxnSuccess: () => void;
};

const DistributorTxnRequestsContext = createContext<DistributorTxnRequestsContextValue | null>(null);

export function DistributorTxnRequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<DistributorTxnRequest[]>(() =>
    DUMMY_TXN_REQUESTS.map((item) => ({ ...item })),
  );
  const [quickTxnSuccess, setQuickTxnSuccess] = useState<QuickTxnSuccessState | null>(null);

  const submitForInvestorConfirmation = useCallback((input: SubmitInvestorConfirmationInput) => {
    let newRequest: DistributorTxnRequest | undefined;

    setRequests((current) => {
      const requestRef = createTxnRequestRef(current);
      newRequest = {
        id: `txn-${Date.now()}`,
        requestRef,
        investorEmailMasked: input.investorEmailMasked,
        clientCode: input.clientCode,
        requestType: input.txnType === "sip" ? "SIP Register" : "Purchase",
        amount: input.amount,
        status: "Pending",
        createdAt: new Date().toISOString(),
        inDistributorBook: true,
      };
      return [newRequest, ...current];
    });

    const success: QuickTxnSuccessState = {
      txnType: input.txnType,
      amount: input.amount,
      sipInstallments: input.sipInstallments,
      clientCode: input.clientCode,
      investorEmailMasked: input.investorEmailMasked,
      fundName: input.fundName,
      irn: input.irn,
      paymentMethodLabel: input.paymentMethodLabel,
      requestRef: newRequest!.requestRef,
    };

    setQuickTxnSuccess(success);
    return success;
  }, []);

  const dismissQuickTxnSuccess = useCallback(() => {
    setQuickTxnSuccess(null);
  }, []);

  const value = useMemo(
    () => ({
      requests,
      quickTxnSuccess,
      submitForInvestorConfirmation,
      dismissQuickTxnSuccess,
    }),
    [dismissQuickTxnSuccess, quickTxnSuccess, requests, submitForInvestorConfirmation],
  );

  return (
    <DistributorTxnRequestsContext.Provider value={value}>
      {children}
    </DistributorTxnRequestsContext.Provider>
  );
}

export function useDistributorTxnRequests() {
  const context = useContext(DistributorTxnRequestsContext);
  if (!context) {
    throw new Error("useDistributorTxnRequests must be used within DistributorTxnRequestsProvider");
  }
  return context;
}
