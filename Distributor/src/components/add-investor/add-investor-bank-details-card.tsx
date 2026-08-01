"use client";

import { Building2, CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type AddInvestorBankDetailsCardProps = {
  isFetched: boolean;
  isFetching: boolean;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  error?: string;
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

export function AddInvestorBankDetailsCard({
  isFetched,
  isFetching,
  accountHolderName,
  bankName,
  branchName,
  error,
}: AddInvestorBankDetailsCardProps) {
  const showPending = !isFetched || isFetching;

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
              ? "Verifying account and fetching bank records…"
              : error ??
                "Will appear after you enter account type, IFSC code, and account number."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-investor-bank-details-card add-investor-bank-details-card--fetched">
      <div className="add-investor-bank-details-card__header">
        <div className="add-investor-bank-details-card__header-icon" aria-hidden>
          <CheckCircle2 className="size-4" strokeWidth={2} />
        </div>
        <div className="add-investor-bank-details-card__header-body">
          <p className="add-investor-bank-details-card__header-title">Bank account details</p>
          <p className="add-investor-bank-details-card__header-desc">
            Verified from bank records for the entered account.
          </p>
        </div>
      </div>

      <div className="add-investor-bank-details-card__grid">
        <BankDetailField label="Account holder" value={accountHolderName} />
        <div className="add-investor-bank-details-card__grid-row">
          <BankDetailField label="Bank" value={bankName} />
          <BankDetailField label="Branch" value={branchName} />
        </div>
      </div>
    </div>
  );
}
