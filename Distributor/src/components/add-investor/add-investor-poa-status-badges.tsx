"use client";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

export type PoaFieldStatus = {
  status?: string | null;
  code?: string | null;
  reason?: string | null;
};

function poaStatusVariant(status?: string | null): StatusBadgeVariant {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "verified") return "success";
  if (normalized === "failed") return "destructive";
  if (normalized === "accepted" || !normalized) return "info";
  return "neutral";
}

function poaStatusLabel(status?: string | null): string {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "verified") return "Verified";
  if (normalized === "failed") return "Failed";
  if (normalized === "accepted") return "In progress";
  if (!normalized) return "Pending";
  return status ?? "Pending";
}

type PoaStatusChipProps = {
  label: string;
  status?: PoaFieldStatus | null;
};

function PoaStatusChip({ label, status }: PoaStatusChipProps) {
  const code = status?.code?.trim();
  const failed = (status?.status ?? "").toLowerCase() === "failed";

  return (
    <span className="add-investor-bank-details-card__poa-chip">
      <StatusBadge variant={poaStatusVariant(status?.status)}>
        <span className="add-investor-bank-details-card__poa-chip-text">
          <span className="add-investor-bank-details-card__poa-chip-name">{label}</span>
          <span className="add-investor-bank-details-card__poa-chip-status">
            {poaStatusLabel(status?.status)}
          </span>
        </span>
      </StatusBadge>
      {failed && code ? (
        <span className="add-investor-bank-details-card__poa-chip-code font-mono">{code}</span>
      ) : null}
    </span>
  );
}

type BankDetailsCardPoaStatusesProps = {
  pan?: PoaFieldStatus | null;
  bank?: PoaFieldStatus | null;
  readiness?: PoaFieldStatus | null;
};

export function BankDetailsCardPoaStatuses({ pan, bank, readiness }: BankDetailsCardPoaStatusesProps) {
  if (!pan && !bank && !readiness) {
    return null;
  }

  return (
    <div className="add-investor-bank-details-card__poa-list add-investor-bank-details-card__poa-list--header">
      {pan ? <PoaStatusChip label="PAN" status={pan} /> : null}
      {bank ? <PoaStatusChip label="Bank" status={bank} /> : null}
      {readiness ? <PoaStatusChip label="Readiness" status={readiness} /> : null}
    </div>
  );
}
