"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createMitraTxnRecommendation,
  fetchMitraTxnRecommendations,
  type CreateMitraTxnRecommendationItemPayload,
} from "@/lib/distributor-txn-recommendations-api";
import {
  mapMitraTxnRecommendationToTransactionGroup,
  mapMitraTxnRecommendationToTxnRequest,
  mapMitraTxnRecommendationsToOperations,
} from "@/lib/map-mitra-txn-recommendation";
import type { DistributorTransactionGroup, DistributorTxnRequest } from "@/lib/distributor-types";
import type { QuickTxnSuccessState } from "@/lib/quick-transaction-success";

export type SubmitInvestorConfirmationInput = {
  clientReference: string;
  txnType: "one-time" | "sip";
  sipInstallments: string;
  clientCode: string;
  investorDisplayName?: string;
  profileImageUrl?: string | null;
  investorEmailMasked: string;
  paymentMethod: "upi" | "netbanking";
  paymentMethodLabel: string;
  items: Array<{
    productId: string;
    amount: number;
    fundName: string;
    irn: string;
    amcLogoUrl?: string | null;
    amcSlug?: string | null;
    logoMark?: string;
  }>;
};

type DistributorTxnRequestsContextValue = {
  requests: DistributorTxnRequest[];
  transactionGroups: DistributorTransactionGroup[];
  requestsLoading: boolean;
  requestsError: string | null;
  quickTxnSuccess: QuickTxnSuccessState | null;
  submitForInvestorConfirmation: (
    input: SubmitInvestorConfirmationInput,
  ) => Promise<QuickTxnSuccessState>;
  dismissQuickTxnSuccess: () => void;
  refreshRequests: () => Promise<void>;
};

const DistributorTxnRequestsContext = createContext<DistributorTxnRequestsContextValue | null>(null);

export function DistributorTxnRequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<DistributorTxnRequest[]>([]);
  const [transactionGroups, setTransactionGroups] = useState<DistributorTransactionGroup[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [quickTxnSuccess, setQuickTxnSuccess] = useState<QuickTxnSuccessState | null>(null);

  const refreshRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const response = await fetchMitraTxnRecommendations({ limit: 100 });
      const mapped = mapMitraTxnRecommendationsToOperations(response.items);
      setRequests(mapped.requests);
      setTransactionGroups(mapped.transactionGroups);
    } catch {
      setRequests([]);
      setTransactionGroups([]);
      setRequestsError("Could not load quick transactions. Try again in a moment.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  const submitForInvestorConfirmation = useCallback(
    async (input: SubmitInvestorConfirmationInput) => {
      const installmentCount = Number.parseInt(input.sipInstallments.trim(), 10);
      const payloadItems: CreateMitraTxnRecommendationItemPayload[] = input.items.map((item) => ({
        product_id: item.productId,
        amount_inr: item.amount,
      }));

      const created = await createMitraTxnRecommendation(input.clientReference, {
        investment_type: input.txnType === "sip" ? "sip" : "one_time",
        payment_method: input.paymentMethod,
        number_of_installments:
          input.txnType === "sip" && Number.isFinite(installmentCount) ? installmentCount : undefined,
        installment_day: input.txnType === "sip" ? 1 : undefined,
        items: payloadItems,
      });

      const fundCount = created.item_count ?? created.items.length ?? input.items.length;
      const mappedRequestBase = mapMitraTxnRecommendationToTxnRequest(
        created,
        input.clientCode,
        input.investorEmailMasked,
      );
      const mappedRequest = {
        ...mappedRequestBase,
        investorDisplayName: input.investorDisplayName ?? mappedRequestBase.investorDisplayName,
        profileImageUrl: input.profileImageUrl ?? mappedRequestBase.profileImageUrl,
      };

      setRequests((current) => [mappedRequest, ...current.filter((row) => row.id !== mappedRequest.id)]);

      if (fundCount > 1) {
        const mappedGroup = mapMitraTxnRecommendationToTransactionGroup(created, input.clientCode);
        setTransactionGroups((current) => [
          mappedGroup,
          ...current.filter((row) => row.id !== mappedGroup.id),
        ]);
      }

      void refreshRequests();

      const requestRef = created.token.slice(0, 8).toUpperCase();
      const fundLines = input.items.map((item) => ({
        fundName: item.fundName,
        irn: item.irn,
        amount: item.amount,
        amcLogoUrl: item.amcLogoUrl ?? null,
        amcSlug: item.amcSlug ?? null,
        logoMark: item.logoMark ?? "MF",
      }));
      const totalAmount = fundLines.reduce((sum, line) => sum + line.amount, 0);
      const primaryFund = fundLines[0];

      const success: QuickTxnSuccessState = {
        txnType: input.txnType,
        amount: totalAmount,
        fundCount: fundLines.length,
        fundLines,
        sipInstallments: input.sipInstallments,
        clientCode: input.clientCode,
        investorEmailMasked: input.investorEmailMasked,
        fundName:
          fundLines.length === 1
            ? primaryFund.fundName
            : `${fundLines.length} funds`,
        irn: primaryFund?.irn ?? "—",
        paymentMethodLabel: input.paymentMethodLabel,
        requestRef,
        recommendationLink: created.link ?? undefined,
        recommendationToken: created.token,
      };

      setQuickTxnSuccess(success);
      return success;
    },
    [refreshRequests],
  );

  const dismissQuickTxnSuccess = useCallback(() => {
    setQuickTxnSuccess(null);
  }, []);

  const value = useMemo(
    () => ({
      requests,
      transactionGroups,
      requestsLoading,
      requestsError,
      quickTxnSuccess,
      submitForInvestorConfirmation,
      dismissQuickTxnSuccess,
      refreshRequests,
    }),
    [
      dismissQuickTxnSuccess,
      quickTxnSuccess,
      refreshRequests,
      requests,
      requestsError,
      requestsLoading,
      transactionGroups,
      submitForInvestorConfirmation,
    ],
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
