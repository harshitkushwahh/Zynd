"use client";

import { Landmark, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { AddBankAccountHeroImage } from "@/components/banking/add-bank-account-hero-image";
import {
  ADD_BANK_ACCOUNT_FORM_ID,
  AddBankAccountForm,
  type AddBankAccountFormState,
} from "@/components/banking/add-bank-account-form";
import { Button } from "@/components/ui/button";
import { SplitFormDialog } from "@/components/ui/split-form-dialog";
import type { InvestorBankAccount } from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";

const INTRO_POINT_ICONS = [
  { icon: ShieldCheck, iconClassName: "bg-primary/10 text-primary" },
  { icon: Landmark, iconClassName: "bg-success/10 text-success" },
] as const;

type AddBankAccountDialogProps = {
  open: boolean;
  formKey?: number;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (account: InvestorBankAccount) => void;
};

export function AddBankAccountDialog({
  open,
  formKey = 0,
  onOpenChange,
  onSuccess,
}: AddBankAccountDialogProps) {
  const bankCopy = copy.settings.bankAccounts;
  const [formState, setFormState] = useState<AddBankAccountFormState>({
    busy: false,
    submitLabel: copy.settings.bankAccounts.verifyAction,
    submitDisabled: false,
  });

  const reset = useCallback(() => {
    setFormState({
      busy: false,
      submitLabel: copy.settings.bankAccounts.verifyAction,
      submitDisabled: false,
    });
  }, []);

  useResetWhenDialogOpens(open, reset);

  const points = bankCopy.addIntroPoints.map((point, index) => ({
    ...point,
    icon: INTRO_POINT_ICONS[index]?.icon ?? ShieldCheck,
    iconClassName: INTRO_POINT_ICONS[index]?.iconClassName ?? "bg-primary/10 text-primary",
  }));

  return (
    <SplitFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={bankCopy.addTitle}
      illustration={<AddBankAccountHeroImage className="w-full max-w-sm" />}
      points={points}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={formState.busy}
            onClick={() => onOpenChange(false)}
          >
            {bankCopy.cancelAdd}
          </Button>
          <Button
            type="submit"
            form={ADD_BANK_ACCOUNT_FORM_ID}
            className="h-11 rounded-full px-5"
            disabled={formState.busy || formState.submitDisabled}
          >
            {formState.submitLabel}
          </Button>
        </>
      }
    >
      <AddBankAccountForm
        key={formKey}
        formId={ADD_BANK_ACCOUNT_FORM_ID}
        hideFooter
        className="min-w-0"
        onFormStateChange={setFormState}
        onSuccess={(account) => {
          onSuccess?.(account);
          onOpenChange(false);
        }}
      />
    </SplitFormDialog>
  );
}
