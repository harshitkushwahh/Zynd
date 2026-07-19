"use client";

import { useMemo, useState } from "react";

import {
  isInvestorBankAccountPaymentReady,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { useInvestorBankAccounts } from "@/features/invest/hooks/use-investor-bank-accounts";

export function usePaymentReadyBankAccounts(enabled: boolean) {
  const { accounts, loading, error, reloadAccounts } = useInvestorBankAccounts(enabled);
  const paymentReadyAccounts = useMemo(
    () => accounts.filter(isInvestorBankAccountPaymentReady),
    [accounts],
  );
  const defaultBankAccountId = useMemo(() => {
    const primary = paymentReadyAccounts.find((account) => account.is_primary);
    return primary?.id ?? paymentReadyAccounts[0]?.id ?? null;
  }, [paymentReadyAccounts]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const resolvedBankAccountId =
    selectedBankAccountId &&
    paymentReadyAccounts.some((account) => account.id === selectedBankAccountId)
      ? selectedBankAccountId
      : defaultBankAccountId;
  const selectedAccount = paymentReadyAccounts.find((account) => account.id === resolvedBankAccountId) ?? null;

  return {
    accounts: paymentReadyAccounts,
    selectedBankAccountId: resolvedBankAccountId,
    selectedAccount,
    setSelectedBankAccountId,
    loading,
    error,
    reloadAccounts,
    hasPaymentReadyAccount: paymentReadyAccounts.length > 0,
  };
}

export type PaymentReadyBankAccountsState = {
  accounts: InvestorBankAccount[];
  selectedBankAccountId: string | null;
  selectedAccount: InvestorBankAccount | null;
  setSelectedBankAccountId: (id: string) => void;
  loading: boolean;
  error: string;
  reloadAccounts: () => Promise<void>;
  hasPaymentReadyAccount: boolean;
};
