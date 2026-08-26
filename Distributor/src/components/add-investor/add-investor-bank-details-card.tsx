"use client";

import { AlertCircle, Building2, CheckCircle2, Loader2 } from "lucide-react";

import {
  BankDetailsCardPoaStatuses,
  type PoaFieldStatus,
} from "@/components/add-investor/add-investor-poa-status-badges";
import { cn } from "@/lib/utils";

export type { PoaFieldStatus };

type AddInvestorBankDetailsCardProps = {
  isFetched: boolean;
  isFetching: boolean;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  error?: string;
  informational?: boolean;
  poaPan?: PoaFieldStatus | null;
  poaBank?: PoaFieldStatus | null;
  poaReadiness?: PoaFieldStatus | null;
};

function BankDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="add-investor-bank-details-card__field">
      <span className="add-investor-bank-details-card__field-label">{label}</span>
      <div className="add-investor-bank-details-card__field-value">
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function hasPoaStatuses(
  poaPan?: PoaFieldStatus | null,
  poaBank?: PoaFieldStatus | null,
  poaReadiness?: PoaFieldStatus | null,
): boolean {
  return Boolean(poaPan || poaBank || poaReadiness);
}

function isBankPoaVerified(poaBank?: PoaFieldStatus | null): boolean {
  return (poaBank?.status ?? "").toLowerCase() === "verified";
}

function isBankPoaFailed(poaBank?: PoaFieldStatus | null): boolean {
  return (poaBank?.status ?? "").toLowerCase() === "failed";
}

export function AddInvestorBankDetailsCard({
  isFetched,
  isFetching,
  accountHolderName,
  bankName,
  branchName,
  error,
  informational = false,
  poaPan,
  poaBank,
  poaReadiness,
}: AddInvestorBankDetailsCardProps) {
  const showPending = !isFetched || isFetching;
  const showPoa = hasPoaStatuses(poaPan, poaBank, poaReadiness);
  const bankVerified = isBankPoaVerified(poaBank);
  const bankFailed = isBankPoaFailed(poaBank);

  if (showPending) {
    return (
      <div
        className={cn(
          "add-investor-bank-details-card add-investor-bank-details-card--pending",
          error && "add-investor-bank-details-card--error",
        )}
      >
        <div className="add-investor-bank-details-card__pending-icon" aria-hidden>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <Building2 className="size-4" strokeWidth={2} />
          )}
        </div>
        <div className="add-investor-bank-details-card__pending-body">
          <p className="add-investor-bank-details-card__pending-title">Bank account details</p>
          <p className="add-investor-bank-details-card__pending-desc">
            {isFetching
              ? "Fetching bank records and verifying account…"
              : error ??
                "Will appear after you enter account type, IFSC code, and account number."}
          </p>
        </div>
      </div>
    );
  }

  const hasBankFields =
    accountHolderName.trim().length > 0 ||
    bankName.trim().length > 0 ||
    branchName.trim().length > 0;

  const headerDesc = (() => {
    if (bankFailed || error) {
      return "Verification could not be completed for this account.";
    }
    if (informational && !bankVerified) {
      return "Bank records fetched. Complete verification to continue.";
    }
    return null;
  })();

  return (
    <div
      className={cn(
        "add-investor-bank-details-card add-investor-bank-details-card--fetched",
        informational && bankFailed && "add-investor-bank-details-card--fetched-error",
        !informational && bankVerified && "add-investor-bank-details-card--fetched-success",
      )}
    >
      <div className="add-investor-bank-details-card__header">
        <div className="add-investor-bank-details-card__header-main">
          <div
            className={cn(
              "add-investor-bank-details-card__header-icon",
              bankFailed && "add-investor-bank-details-card__header-icon--error",
            )}
            aria-hidden
          >
            {bankFailed ? (
              <AlertCircle className="size-4" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="size-4" strokeWidth={2} />
            )}
          </div>
          <div className="add-investor-bank-details-card__header-body">
            <p className="add-investor-bank-details-card__header-title">Bank account details</p>
            {headerDesc ? (
              <p className="add-investor-bank-details-card__header-desc">{headerDesc}</p>
            ) : null}
          </div>
        </div>
        {showPoa ? (
          <BankDetailsCardPoaStatuses pan={poaPan} bank={poaBank} readiness={poaReadiness} />
        ) : null}
      </div>

      {hasBankFields ? (
        <div className="add-investor-bank-details-card__grid">
          {accountHolderName.trim() ? (
            <BankDetailField label="Account holder" value={accountHolderName} />
          ) : null}
          {bankName.trim() || branchName.trim() ? (
            <div className="add-investor-bank-details-card__grid-row">
              {bankName.trim() ? <BankDetailField label="Bank" value={bankName} /> : null}
              {branchName.trim() ? <BankDetailField label="Branch" value={branchName} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="add-investor-bank-details-card__error">{error}</p> : null}
    </div>
  );
}
