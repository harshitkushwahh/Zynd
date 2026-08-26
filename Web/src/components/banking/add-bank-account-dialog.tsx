"use client";

import { Check, Info } from "lucide-react";
import { useCallback, useState } from "react";

import { AddBankAccountHeroImage } from "@/components/banking/add-bank-account-hero-image";
import {
  ADD_BANK_ACCOUNT_FORM_ID,
  AddBankAccountForm,
  type AddBankAccountFormState,
} from "@/components/banking/add-bank-account-form";
import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import type { InvestorBankAccount } from "@/features/invest/lib/investor-bank-accounts-api";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { cn } from "@/lib/utils";

type AddBankStep = "intro" | "details";

const STEPS: AddBankStep[] = ["intro", "details"];

const INTRO_POINTS = [
  {
    icon: Check,
    tone: "primary" as const,
    text: copy.settings.bankAccounts.addIntroPanVerification,
  },
  {
    icon: Info,
    tone: "info" as const,
    text: copy.settings.bankAccounts.addIntroUsage,
  },
];

type AddBankProgressProps = {
  step: AddBankStep;
  compact?: boolean;
};

function AddBankProgress({ step, compact = false }: AddBankProgressProps) {
  const currentIndex = STEPS.indexOf(step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
      {STEPS.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-primary",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

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
  const [step, setStep] = useState<AddBankStep>("intro");
  const [formState, setFormState] = useState<AddBankAccountFormState>({
    busy: false,
    submitLabel: copy.kyc.bank.verify,
    submitDisabled: false,
  });

  const reset = useCallback(() => {
    setStep("intro");
    setFormState({
      busy: false,
      submitLabel: copy.kyc.bank.verify,
      submitDisabled: false,
    });
  }, []);

  useResetWhenDialogOpens(open, reset);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.settings.bankAccounts.addTitle}
      maxWidth="lg"
    >
      <div className={cn("px-5 pb-5", step === "intro" ? "pt-4" : "pt-1.5")}>
        <AddBankProgress step={step} compact={step !== "intro"} />

        {step === "intro" ? (
          <div className="space-y-5">
            <AddBankAccountHeroImage />

            <ul className="space-y-2.5">
              {INTRO_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.text} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        point.tone === "primary" && "bg-primary/10 text-primary",
                        point.tone === "info" && "bg-info/10 text-info",
                      )}
                    >
                      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {point.text}
                  </li>
                );
              })}
            </ul>

            <AuthSubmitFooter className="pt-0">
              <Button type="button" className="w-full" onClick={() => setStep("details")}>
                {copy.mfa.continue}
              </Button>
            </AuthSubmitFooter>
          </div>
        ) : (
          <>
            <AddBankAccountForm
              key={formKey}
              formId={ADD_BANK_ACCOUNT_FORM_ID}
              hideFooter
              className="mt-2"
              onFormStateChange={setFormState}
              onSuccess={(account) => {
                onSuccess?.(account);
                handleOpenChange(false);
              }}
            />

            <AuthSubmitFooter className="pt-2">
              <Button
                type="submit"
                form={ADD_BANK_ACCOUNT_FORM_ID}
                className="w-full"
                disabled={formState.busy || formState.submitDisabled}
              >
                {formState.submitLabel}
              </Button>
            </AuthSubmitFooter>
          </>
        )}
      </div>
    </BrandDialog>
  );
}
