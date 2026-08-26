"use client";

import { useCallback } from "react";

import { useKycOptional } from "@/contexts/kyc-context";
import { useAddBankAccountDialogOptional } from "@/contexts/add-bank-account-dialog-context";
import {
  MAX_BANK_ACCOUNTS,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";

type UseAddBankAccountActionOptions = {
  accounts: InvestorBankAccount[];
  onAccountAdded?: (account: InvestorBankAccount) => void;
};

export function useAddBankAccountAction({
  accounts,
  onAccountAdded,
}: UseAddBankAccountActionOptions) {
  const kyc = useKycOptional();
  const addBankAccountDialog = useAddBankAccountDialogOptional();

  const kycCompleted = kyc?.overallStatus === "completed";
  const canAddAccount = kycCompleted && accounts.length < MAX_BANK_ACCOUNTS;

  const requestAddBankAccount = useCallback(() => {
    if (!kycCompleted) {
      kyc?.openDialog();
      return;
    }
    if (accounts.length >= MAX_BANK_ACCOUNTS) {
      return;
    }
    addBankAccountDialog?.open({
      onSuccess: onAccountAdded,
    });
  }, [accounts.length, addBankAccountDialog, kyc, kycCompleted, onAccountAdded]);

  return {
    canAddAccount,
    requestAddBankAccount,
  };
}
