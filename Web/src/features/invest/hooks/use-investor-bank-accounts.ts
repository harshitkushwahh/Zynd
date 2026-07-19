"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchInvestorBankAccounts,
  type InvestorBankAccount,
} from "@/features/invest/lib/investor-bank-accounts-api";

export function useInvestorBankAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<InvestorBankAccount[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const reloadAccounts = useCallback(async () => {
    if (!enabled) {
      setAccounts([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetchInvestorBankAccounts();
      setAccounts(response.bank_accounts);
    } catch (err) {
      setAccounts([]);
      setError(err instanceof Error ? err.message : "Could not load bank accounts.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reloadAccounts();
  }, [reloadAccounts]);

  return {
    accounts,
    loading,
    error,
    reloadAccounts,
  };
}
