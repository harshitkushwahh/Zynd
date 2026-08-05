"use client";

import { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";

import { AddInvestorBankDetailsCard } from "@/components/add-investor/add-investor-bank-details-card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchDemoBankDetails,
  normalizeIfscInput,
} from "@/lib/add-investor/add-investor-demo";
import {
  ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS,
  isValidAddInvestorIfsc,
  type AddInvestorBankDraft,
} from "@/lib/add-investor/add-investor-journey";

type AddInvestorBankPanelProps = {
  bank: AddInvestorBankDraft;
  onBankChange: (patch: Partial<AddInvestorBankDraft>) => void;
  accountHolderName: string;
};

function maskedAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits ? `****${digits.slice(-4)}` : "—";
}

function bankAccountTypeLabel(accountType: string): string {
  return (
    ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS.find((option) => option.value === accountType)
      ?.label ?? accountType
  );
}

export function formatAddInvestorBankSummary(bank: AddInvestorBankDraft): string {
  if (!bank.bankName.trim()) {
    return "—";
  }

  const accountTypeLabel = bank.accountType ? bankAccountTypeLabel(bank.accountType) : null;

  return [bank.bankName, accountTypeLabel, maskedAccountNumber(bank.accountNumber), bank.ifsc]
    .filter(Boolean)
    .join(" · ");
}

export function formatAddInvestorBankReviewItems(
  bank: AddInvestorBankDraft,
): Array<{ label: string; value: string; tone?: "default" | "muted" }> {
  if (!bank.bankName.trim()) {
    return [{ label: "Payout account", value: "Not added", tone: "muted" }];
  }

  const branchSuffix = bank.branchName.trim() ? ` · ${bank.branchName.trim()}` : "";

  return [
    { label: "Account holder", value: bank.accountHolderName.trim() },
    { label: "Bank", value: `${bank.bankName.trim()}${branchSuffix}` },
    {
      label: "Account type",
      value: bank.accountType ? bankAccountTypeLabel(bank.accountType) : "—",
    },
    { label: "Account number", value: maskedAccountNumber(bank.accountNumber) },
    { label: "IFSC", value: bank.ifsc.trim().toUpperCase() },
  ].filter((item) => item.value && item.value !== "—");
}

function canFetchBankDetails(bank: AddInvestorBankDraft): boolean {
  return (
    Boolean(bank.accountType) &&
    isValidAddInvestorIfsc(bank.ifsc) &&
    bank.accountNumber.replace(/\D/g, "").length >= 9
  );
}

function buildFetchKey(bank: AddInvestorBankDraft): string {
  return [bank.accountType, normalizeIfscInput(bank.ifsc), bank.accountNumber.replace(/\D/g, "")].join(
    "|",
  );
}

export function AddInvestorBankPanel({
  bank,
  onBankChange,
  accountHolderName,
}: AddInvestorBankPanelProps) {
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const lastFetchedKey = useRef(
    bank.accountVerified && canFetchBankDetails(bank) ? buildFetchKey(bank) : "",
  );

  const hasDetails =
    bank.accountVerified &&
    bank.accountHolderName.trim().length > 0 &&
    bank.bankName.trim().length > 0 &&
    bank.branchName.trim().length > 0;

  const inputsLocked = detailsLoading || bank.accountVerified;

  useEffect(() => {
    if (!canFetchBankDetails(bank)) {
      lastFetchedKey.current = "";
      return;
    }

    const fetchKey = buildFetchKey(bank);
    if (lastFetchedKey.current === fetchKey) {
      return;
    }

    let cancelled = false;

    const loadDetails = async () => {
      setDetailsLoading(true);
      setDetailsError("");

      const result = await fetchDemoBankDetails({
        ifsc: bank.ifsc,
        accountNumber: bank.accountNumber,
        accountType: bank.accountType,
        accountHolderName,
      });

      if (cancelled) {
        return;
      }

      setDetailsLoading(false);

      if (!result.ok) {
        setDetailsError(result.error);
        onBankChange({
          accountHolderName: "",
          bankName: "",
          branchName: "",
          accountVerified: false,
        });
        return;
      }

      lastFetchedKey.current = fetchKey;
      onBankChange({
        accountHolderName: result.accountHolderName,
        bankName: result.bankName,
        branchName: result.branchName,
        accountVerified: true,
      });
    };

    void loadDetails();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch when bank inputs change
  }, [
    accountHolderName,
    bank.accountNumber,
    bank.accountType,
    bank.ifsc,
  ]);

  const resetFetchedDetails = () => {
    lastFetchedKey.current = "";
    setDetailsError("");
    onBankChange({
      accountHolderName: "",
      bankName: "",
      branchName: "",
      accountVerified: false,
    });
  };

  const handleAccountNumberChange = (value: string) => {
    resetFetchedDetails();
    onBankChange({ accountNumber: value.replace(/\D/g, "") });
  };

  const handleAccountTypeChange = (value: string) => {
    resetFetchedDetails();
    onBankChange({ accountType: value });
  };

  const handleIfscChange = (value: string) => {
    resetFetchedDetails();
    onBankChange({ ifsc: normalizeIfscInput(value) });
  };

  return (
    <div className="add-investor-onboarding-wizard__center add-investor-bank-panel">
      <span className="add-investor-onboarding-wizard__hero-icon" aria-hidden>
        <Landmark className="size-6" strokeWidth={2.25} />
      </span>
      <h3 className="add-investor-onboarding-wizard__title">Bank account</h3>

      <div className="add-investor-bank-panel__form">
        <AddInvestorBankDetailsCard
          isFetched={hasDetails}
          isFetching={detailsLoading}
          accountHolderName={bank.accountHolderName}
          bankName={bank.bankName}
          branchName={bank.branchName}
          error={detailsError || undefined}
        />

        <Field>
          <FieldLabel htmlFor="add-investor-bank-acct">Account number</FieldLabel>
          <Input
            id="add-investor-bank-acct"
            inputMode="numeric"
            value={bank.accountNumber}
            onChange={(event) => handleAccountNumberChange(event.target.value)}
            placeholder="Enter account number"
            disabled={inputsLocked}
            className="add-investor-bank-panel__account-input font-mono"
          />
        </Field>

        <div className="add-investor-bank-panel__row">
          <Field>
            <FieldLabel htmlFor="add-investor-bank-type">Account type</FieldLabel>
            <Select
              value={bank.accountType}
              onValueChange={handleAccountTypeChange}
              disabled={inputsLocked}
            >
              <SelectTrigger id="add-investor-bank-type" className="add-investor-bank-panel__select">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="add-investor-bank-ifsc">IFSC code</FieldLabel>
            <Input
              id="add-investor-bank-ifsc"
              value={bank.ifsc}
              onChange={(event) => handleIfscChange(event.target.value)}
              placeholder="HDFC0001234"
              autoComplete="off"
              spellCheck={false}
              disabled={inputsLocked}
              className="add-investor-bank-panel__ifsc-input font-mono uppercase tracking-wide"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
