"use client";

import { useState } from "react";
import { Landmark, Loader2 } from "lucide-react";

import { AddInvestorBankDetailsCard } from "@/components/add-investor/add-investor-bank-details-card";
import type { PoaFieldStatus } from "@/components/add-investor/add-investor-poa-status-badges";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { ApiError } from "@/lib/api-client";
import {
  fetchClientKycBankPreverifyStatus,
  verifyClientKycBankHybrid,
  type ClientKycBankVerifyResponse,
} from "@/lib/distributor-client-onboarding-api";
import { normalizeIfscInput } from "@/lib/add-investor/add-investor-demo";
import { isValidAddInvestorIfsc, type AddInvestorBankDraft } from "@/lib/add-investor/add-investor-journey";
import {
  ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS,
  lookupAddInvestorEnumLabel,
} from "@/lib/add-investor/add-investor-kyc-master-data";
import { pollWithBackoff } from "@/lib/add-investor/kyc-polling";

type AddInvestorBankPanelProps = {
  bank: AddInvestorBankDraft;
  onBankChange: (patch: Partial<AddInvestorBankDraft>) => void;
  accountHolderName: string;
  clientUserId: string | null;
  panVerified?: boolean;
};

type BankLookupPreview = {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  kyckartError?: string;
  poaPan?: PoaFieldStatus | null;
  poaBank?: PoaFieldStatus | null;
  poaReadiness?: PoaFieldStatus | null;
};

function maskedAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits ? `****${digits.slice(-4)}` : "—";
}

function bankAccountTypeLabel(accountType: string): string {
  return lookupAddInvestorEnumLabel(accountType, ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS);
}

function applyVerifyResult(result: ClientKycBankVerifyResponse): BankLookupPreview {
  return {
    accountHolderName: result.kyckart_account_holder_name?.trim() || result.account_holder_name?.trim() || "—",
    bankName: result.bank_name?.trim() || "—",
    branchName: result.branch?.trim() || "—",
    kyckartError: result.kyckart_lookup_error?.trim() || undefined,
    poaPan: result.poa_pan_status ?? null,
    poaBank: result.poa_bank_status ?? null,
    poaReadiness: result.poa_readiness_status ?? null,
  };
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

function canVerifyBankDetails(bank: AddInvestorBankDraft): boolean {
  return (
    Boolean(bank.accountType) &&
    isValidAddInvestorIfsc(bank.ifsc) &&
    bank.accountNumber.replace(/\D/g, "").length >= 9
  );
}

export function AddInvestorBankPanel({
  bank,
  onBankChange,
  accountHolderName,
  clientUserId,
  panVerified = false,
}: AddInvestorBankPanelProps) {
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [lookupPreview, setLookupPreview] = useState<BankLookupPreview | null>(null);

  const hasPoaStatuses = Boolean(
    lookupPreview?.poaPan || lookupPreview?.poaBank || lookupPreview?.poaReadiness,
  );

  const hasKyckartPreview =
    Boolean(lookupPreview?.accountHolderName && lookupPreview.accountHolderName !== "—") ||
    Boolean(lookupPreview?.bankName && lookupPreview.bankName !== "—");

  const hasDetails =
    bank.accountVerified &&
    bank.accountHolderName.trim().length > 0 &&
    bank.bankName.trim().length > 0;

  const showResultCard = hasDetails || hasKyckartPreview || hasPoaStatuses;

  const inputsLocked = detailsLoading || bank.accountVerified;
  const panNameForVerification = accountHolderName.trim();

  const resetVerification = () => {
    setDetailsError("");
    setLookupPreview(null);
    onBankChange({
      accountHolderName: "",
      bankName: "",
      branchName: "",
      accountVerified: false,
    });
  };

  const handleVerifyBankAccount = async () => {
    if (!clientUserId) {
      setDetailsError("Complete investor onboarding before verifying bank details.");
      return;
    }
    if (!panVerified || !panNameForVerification) {
      setDetailsError("Complete PAN verification and confirm the investor name before verifying bank details.");
      return;
    }
    if (!canVerifyBankDetails(bank)) {
      setDetailsError("Enter account type, a valid IFSC code, and account number first.");
      return;
    }

    setDetailsLoading(true);
    setDetailsError("");
    resetVerification();

    try {
      let result = await verifyClientKycBankHybrid(clientUserId, {
        account_number: bank.accountNumber.replace(/\D/g, ""),
        account_type: bank.accountType,
        ifsc_code: normalizeIfscInput(bank.ifsc),
      });

      let bankVerified = result.bank_verified;
      let failureReason = result.failure?.reason;

      if (
        !bankVerified &&
        result.preverify_id &&
        !result.requires_manual_verification &&
        !result.requires_proof_upload
      ) {
        const polled = await pollWithBackoff(
          () => fetchClientKycBankPreverifyStatus(clientUserId, result.preverify_id!),
          (status) => !status.bank_verified,
          { maxAttempts: 8, baseDelayMs: 1000 },
        );
        bankVerified = polled.bank_verified;
        if (polled.reason?.trim()) {
          failureReason = polled.reason.trim();
        }
        result = {
          ...result,
          bank_verified: polled.bank_verified,
          pan_verified: polled.pan_verified ?? result.pan_verified,
          readiness_verified: polled.readiness_verified ?? result.readiness_verified,
          poa_pan_status: polled.poa_pan_status ?? result.poa_pan_status,
          poa_bank_status: polled.poa_bank_status ?? result.poa_bank_status,
          poa_readiness_status: polled.poa_readiness_status ?? result.poa_readiness_status,
          failure: polled.reason
            ? { field: "bank_account", reason: polled.reason, code: polled.code }
            : result.failure,
        };
      }

      const preview = applyVerifyResult(result);
      setLookupPreview(preview);

      if (bankVerified) {
        onBankChange({
          accountHolderName: preview.accountHolderName !== "—" ? preview.accountHolderName : panNameForVerification,
          bankName: preview.bankName !== "—" ? preview.bankName : bank.bankName,
          branchName: preview.branchName !== "—" ? preview.branchName : bank.branchName || "—",
          accountVerified: true,
        });
        return;
      }

      if (result.requires_manual_verification || result.requires_proof_upload) {
        setDetailsError(
          failureReason ||
            "This account needs manual verification with bank proof in the investor KYC flow.",
        );
        return;
      }

      setDetailsError(
        failureReason || "Could not verify this bank account. Collect the correct account and retry.",
      );
    } catch (error) {
      setDetailsError(error instanceof ApiError ? error.message : "Could not verify bank account.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAccountNumberChange = (value: string) => {
    resetVerification();
    onBankChange({ accountNumber: value.replace(/\D/g, "") });
  };

  const handleAccountTypeChange = (value: string | null) => {
    if (!value) return;
    resetVerification();
    onBankChange({ accountType: value });
  };

  const handleIfscChange = (value: string) => {
    resetVerification();
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
          isFetched={showResultCard}
          isFetching={detailsLoading}
          accountHolderName={hasDetails ? bank.accountHolderName : lookupPreview?.accountHolderName ?? ""}
          bankName={hasDetails ? bank.bankName : lookupPreview?.bankName ?? ""}
          branchName={hasDetails ? bank.branchName : lookupPreview?.branchName ?? ""}
          error={detailsError || lookupPreview?.kyckartError}
          informational={!bank.accountVerified}
          poaPan={lookupPreview?.poaPan}
          poaBank={lookupPreview?.poaBank}
          poaReadiness={lookupPreview?.poaReadiness}
        />

        {!panVerified || !panNameForVerification ? (
          <p className="text-destructive text-sm">
            Complete PAN verification first before verifying the bank account.
          </p>
        ) : null}

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

        {!bank.accountVerified ? (
          <DistributorActionButton
            type="button"
            className="w-full"
            disabled={
              detailsLoading ||
              !canVerifyBankDetails(bank) ||
              !clientUserId ||
              !panVerified ||
              !panNameForVerification
            }
            onClick={() => void handleVerifyBankAccount()}
          >
            {detailsLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Verifying bank account…
              </>
            ) : (
              "Verify bank account"
            )}
          </DistributorActionButton>
        ) : (
          <DistributorActionButton type="button" variant="outline" className="w-full" onClick={resetVerification}>
            Edit bank details
          </DistributorActionButton>
        )}
      </div>
    </div>
  );
}
