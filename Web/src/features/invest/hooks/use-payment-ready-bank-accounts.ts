"use client";

import { useMemo, useState } from "react";

import { useKycOptional } from "@/contexts/kyc-context";
import {
  isInvestorBankAccountPaymentReady,
  isInvestorBankAccountVerified,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";
import { useInvestorBankAccounts } from "@/features/invest/hooks/use-investor-bank-accounts";

function sortBankAccountsForPicker(accounts: InvestorBankAccount[]) {
  return [...accounts].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    return (left.bank_name ?? "").localeCompare(right.bank_name ?? "");
  });
}

export function usePaymentReadyBankAccounts(enabled: boolean) {
  const kyc = useKycOptional();
  const kycVerified = kyc?.overallStatus === "completed";
  const shouldLoadAccounts = enabled && kycVerified;
  const { accounts, loading, error, reloadAccounts } = useInvestorBankAccounts(shouldLoadAccounts);
  const verifiedAccounts = useMemo(
    () => sortBankAccountsForPicker(accounts.filter(isInvestorBankAccountVerified)),
    [accounts],
  );
  const paymentReadyAccounts = useMemo(
    () => sortBankAccountsForPicker(accounts.filter(isInvestorBankAccountPaymentReady)),
    [accounts],
  );
  const pickerAccounts = verifiedAccounts.length > 0 ? verifiedAccounts : paymentReadyAccounts;

  const defaultBankAccountId = useMemo(() => {
    const primaryReady = paymentReadyAccounts.find((account) => account.is_primary);
    if (primaryReady) return primaryReady.id;
    const primaryVerified = verifiedAccounts.find((account) => account.is_primary);
    if (primaryVerified) return primaryVerified.id;
    return paymentReadyAccounts[0]?.id ?? verifiedAccounts[0]?.id ?? null;
  }, [paymentReadyAccounts, verifiedAccounts]);

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const resolvedBankAccountId =
    selectedBankAccountId &&
    pickerAccounts.some((account) => account.id === selectedBankAccountId)
      ? selectedBankAccountId
      : defaultBankAccountId;

  const selectedAccount =
    pickerAccounts.find((account) => account.id === resolvedBankAccountId) ?? null;

  return {
    accounts: pickerAccounts,
    allAccounts: accounts,
    paymentReadyAccounts,
    selectedBankAccountId: resolvedBankAccountId,
    selectedAccount,
    setSelectedBankAccountId,
    loading,
    error,
    reloadAccounts,
    hasPaymentReadyAccount:
      paymentReadyAccounts.length > 0 || verifiedAccounts.length > 0,
    hasVerifiedAccount: verifiedAccounts.length > 0,
  };
}

export type PaymentReadyBankAccountsState = {
  accounts: InvestorBankAccount[];
  allAccounts: InvestorBankAccount[];
  paymentReadyAccounts: InvestorBankAccount[];
  selectedBankAccountId: string | null;
  selectedAccount: InvestorBankAccount | null;
  setSelectedBankAccountId: (id: string) => void;
  loading: boolean;
  error: string;
  reloadAccounts: () => Promise<void>;
  hasPaymentReadyAccount: boolean;
  hasVerifiedAccount: boolean;
};
