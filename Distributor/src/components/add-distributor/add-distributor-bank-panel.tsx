"use client";

import { Landmark, Loader2 } from "lucide-react";

import { AddInvestorBankDetailsCard } from "@/components/add-investor/add-investor-bank-details-card";
import { AddDistributorWizardPanelShell } from "@/components/add-distributor/add-distributor-wizard-panel-shell";
import { AddInvestorWizardStepFooter } from "@/components/add-investor/add-investor-wizard-step-footer";
import { Button } from "@/components/ui/button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeIfscInput } from "@/lib/add-investor/add-investor-demo";
import {
  ADD_DISTRIBUTOR_BANK_ACCOUNT_TYPE_OPTIONS,
  type AddDistributorBankDraft,
} from "@/lib/add-distributor/add-distributor-journey";

type AddDistributorBankPanelProps = {
  bank: AddDistributorBankDraft;
  onBankChange: (patch: Partial<AddDistributorBankDraft>) => void;
  bankVerified: boolean;
  bankLoading: boolean;
  bankError: string;
  showManualFallback: boolean;
  onEnterManualMode: () => void;
  onBack: () => void;
  onContinue: () => void;
  canBack: boolean;
  continueDisabled: boolean;
};

export function AddDistributorBankPanel({
  bank,
  onBankChange,
  bankVerified,
  bankLoading,
  bankError,
  showManualFallback,
  onEnterManualMode,
  onBack,
  onContinue,
  canBack,
  continueDisabled,
}: AddDistributorBankPanelProps) {
  const manualMode = bank.manualMode;
  const hasAutoDetails =
    !manualMode &&
    bankVerified &&
    bank.accountHolderName.trim().length > 0 &&
    bank.bankName.trim().length > 0 &&
    bank.branchName.trim().length > 0;

  const inputsLocked = bankLoading || bankVerified;

  const resetVerifiedDetails = () => {
    onBankChange({
      accountHolderName: "",
      bankName: "",
      branchName: "",
      accountVerified: false,
      verificationMode: "",
    });
  };

  const handleAccountNumberChange = (value: string) => {
    resetVerifiedDetails();
    onBankChange({ accountNumber: value.replace(/\D/g, "").slice(0, 18) });
  };

  const handleConfirmAccountNumberChange = (value: string) => {
    resetVerifiedDetails();
    onBankChange({ confirmAccountNumber: value.replace(/\D/g, "").slice(0, 18) });
  };

  const handleAccountTypeChange = (value: string | null) => {
    if (!value) return;
    resetVerifiedDetails();
    onBankChange({ accountType: value });
  };

  const handleIfscChange = (value: string) => {
    resetVerifiedDetails();
    onBankChange({ ifsc: normalizeIfscInput(value) });
  };

  const accountMismatch =
    manualMode &&
    bank.confirmAccountNumber.length > 0 &&
    bank.accountNumber.replace(/\D/g, "") !== bank.confirmAccountNumber.replace(/\D/g, "");

  return (
    <AddDistributorWizardPanelShell
      stepId="bank"
      title="Onboarding"
      className="add-investor-wizard-panel--onboarding"
      footer={
        <AddInvestorWizardStepFooter
          onBack={onBack}
          onContinue={onContinue}
          canBack={canBack}
          continueDisabled={continueDisabled}
          continueLabel={
            bankLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {manualMode ? "Saving…" : "Verifying…"}
              </>
            ) : bankVerified ? (
              "Continue"
            ) : manualMode ? (
              "Save bank details"
            ) : (
              "Verify bank account"
            )
          }
        />
      }
    >
      <div className="add-investor-onboarding-wizard__center add-distributor-bank-panel">
        <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
          <Landmark className="size-6" strokeWidth={2.25} />
        </span>
        <h3 className="add-investor-onboarding-wizard__title">Bank account</h3>
        <p className="add-investor-onboarding-wizard__desc">
          Verify the settlement account for trail and upfront commissions.
        </p>

        <div className="add-investor-bank-panel__form">
          {!manualMode ? (
            <>
              <AddInvestorBankDetailsCard
                isFetched={hasAutoDetails}
                isFetching={bankLoading}
                accountHolderName={bank.accountHolderName}
                bankName={bank.bankName}
                branchName={bank.branchName}
              />

              <Field>
                <FieldLabel htmlFor="dist-bank-acct">Account number</FieldLabel>
                <Input
                  id="dist-bank-acct"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bank.accountNumber}
                  disabled={inputsLocked}
                  onChange={(event) => handleAccountNumberChange(event.target.value)}
                  placeholder="Enter account number"
                  className="add-investor-bank-panel__account-input font-mono"
                />
              </Field>

              <div className="add-investor-bank-panel__row">
                <Field>
                  <FieldLabel htmlFor="dist-bank-type">Account type</FieldLabel>
                  <Select
                    value={bank.accountType}
                    onValueChange={handleAccountTypeChange}
                    disabled={inputsLocked}
                  >
                    <SelectTrigger id="dist-bank-type" className="add-investor-bank-panel__select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_DISTRIBUTOR_BANK_ACCOUNT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="dist-bank-ifsc">IFSC code</FieldLabel>
                  <Input
                    id="dist-bank-ifsc"
                    value={bank.ifsc}
                    disabled={inputsLocked}
                    onChange={(event) => handleIfscChange(event.target.value)}
                    placeholder="HDFC0001234"
                    autoComplete="off"
                    spellCheck={false}
                    className="add-investor-bank-panel__ifsc-input font-mono uppercase tracking-wide"
                  />
                </Field>
              </div>

              {bankError && !bankVerified ? (
                <DistributorFeedbackMessage variant="error" className="add-distributor-wizard-feedback">
                  {bankError}
                </DistributorFeedbackMessage>
              ) : null}

              {showManualFallback && !bankVerified ? (
                <div className="add-distributor-bank-panel__fallback">
                  <p className="add-distributor-bank-panel__fallback-text">
                    Bank verification unavailable? Enter account details manually for HO review.
                  </p>
                  <Button type="button" variant="ghost" size="sm" disabled={bankLoading} onClick={onEnterManualMode}>
                    Enter details manually
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="add-distributor-wizard-step-card add-distributor-bank-panel__manual">
              <p className="add-distributor-bank-panel__manual-note">
                Manual entry — details will be reviewed by HO during compliance approval.
              </p>

              {bankVerified && bank.accountHolderName ? (
                <AddInvestorBankDetailsCard
                  isFetched
                  isFetching={false}
                  accountHolderName={bank.accountHolderName}
                  bankName={bank.bankName}
                  branchName={bank.branchName}
                />
              ) : null}

              <Field>
                <FieldLabel htmlFor="dist-bank-holder">Account holder name</FieldLabel>
                <Input
                  id="dist-bank-holder"
                  value={bank.accountHolderName}
                  disabled={inputsLocked}
                  onChange={(event) => {
                    resetVerifiedDetails();
                    onBankChange({ accountHolderName: event.target.value });
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="dist-bank-name">Bank name</FieldLabel>
                <Input
                  id="dist-bank-name"
                  placeholder="e.g. HDFC Bank"
                  value={bank.bankName}
                  disabled={inputsLocked}
                  onChange={(event) => {
                    resetVerifiedDetails();
                    onBankChange({ bankName: event.target.value });
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="dist-bank-branch">Branch</FieldLabel>
                <Input
                  id="dist-bank-branch"
                  placeholder="e.g. Andheri West"
                  value={bank.branchName}
                  disabled={inputsLocked}
                  onChange={(event) => {
                    resetVerifiedDetails();
                    onBankChange({ branchName: event.target.value });
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="dist-bank-acct-manual">Account number</FieldLabel>
                <Input
                  id="dist-bank-acct-manual"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bank.accountNumber}
                  disabled={inputsLocked}
                  onChange={(event) => handleAccountNumberChange(event.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="dist-bank-acct-confirm">Confirm account number</FieldLabel>
                <Input
                  id="dist-bank-acct-confirm"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bank.confirmAccountNumber}
                  disabled={inputsLocked}
                  onChange={(event) => handleConfirmAccountNumberChange(event.target.value)}
                  className="font-mono"
                />
                {accountMismatch ? (
                  <p className="text-caption text-destructive">Account numbers do not match.</p>
                ) : null}
              </Field>

              <div className="add-investor-bank-panel__row">
                <Field>
                  <FieldLabel htmlFor="dist-bank-type-manual">Account type</FieldLabel>
                  <Select
                    value={bank.accountType}
                    onValueChange={handleAccountTypeChange}
                    disabled={inputsLocked}
                  >
                    <SelectTrigger id="dist-bank-type-manual" className="add-investor-bank-panel__select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADD_DISTRIBUTOR_BANK_ACCOUNT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="dist-bank-ifsc-manual">IFSC code</FieldLabel>
                  <Input
                    id="dist-bank-ifsc-manual"
                    value={bank.ifsc}
                    disabled={inputsLocked}
                    onChange={(event) => handleIfscChange(event.target.value)}
                    placeholder="HDFC0001234"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono uppercase tracking-wide"
                  />
                </Field>
              </div>

              {!bankVerified ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={bankLoading}
                  onClick={() => onBankChange({ manualMode: false })}
                >
                  Try automatic verification
                </Button>
              ) : null}

              {bankError ? (
                <DistributorFeedbackMessage variant="error" className="add-distributor-wizard-feedback">
                  {bankError}
                </DistributorFeedbackMessage>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AddDistributorWizardPanelShell>
  );
}
