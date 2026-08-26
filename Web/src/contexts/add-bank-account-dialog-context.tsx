"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AddBankAccountDialog } from "@/components/banking/add-bank-account-dialog";
import type { InvestorBankAccount } from "@/features/invest/lib/investor-bank-accounts-api";

type OpenAddBankAccountDialogOptions = {
  onSuccess?: (account: InvestorBankAccount) => void;
};

type AddBankAccountDialogContextValue = {
  open: (options?: OpenAddBankAccountDialogOptions) => void;
  close: () => void;
};

const AddBankAccountDialogContext = createContext<AddBankAccountDialogContextValue | null>(null);

export function AddBankAccountDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const onSuccessRef = useRef<((account: InvestorBankAccount) => void) | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    onSuccessRef.current = undefined;
  }, []);

  const openDialog = useCallback((options?: OpenAddBankAccountDialogOptions) => {
    onSuccessRef.current = options?.onSuccess;
    setFormKey((value) => value + 1);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      open: openDialog,
      close,
    }),
    [close, openDialog],
  );

  return (
    <AddBankAccountDialogContext.Provider value={value}>
      {children}
      <AddBankAccountDialog
        open={open}
        formKey={formKey}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
          else setOpen(true);
        }}
        onSuccess={(account) => {
          onSuccessRef.current?.(account);
          close();
        }}
      />
    </AddBankAccountDialogContext.Provider>
  );
}

export function useAddBankAccountDialog() {
  const context = useContext(AddBankAccountDialogContext);
  if (!context) {
    throw new Error("useAddBankAccountDialog must be used within AddBankAccountDialogProvider");
  }
  return context;
}

export function useAddBankAccountDialogOptional() {
  return useContext(AddBankAccountDialogContext);
}
