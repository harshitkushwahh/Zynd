import type { ClientKycPayloadMetaRow } from "@/components/clients/client-kyc-payload-view-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { formatDistributorDateTime } from "@/lib/format";
import type {
  SupportKycIfscLookupSummary,
  SupportKycPartnerResponseVariant,
  SupportKycPartnerVerificationStatus,
} from "@/lib/support-client-kyc-partner-model";

function statusBadgeVariant(
  status: SupportKycPartnerVerificationStatus,
): "success" | "warning" | "destructive" | "neutral" | "info" {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "skipped":
      return "neutral";
    case "not_started":
      return "info";
    default:
      return "neutral";
  }
}

export function buildPartnerResponseMetaRows(
  meta: SupportKycPartnerResponseVariant,
): ClientKycPayloadMetaRow[] {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const rows: ClientKycPayloadMetaRow[] = [
    { label: copy.partnerResponsePartnerLabel, value: meta.partner },
    { label: copy.partnerResponseRecordedAtLabel, value: formatDistributorDateTime(meta.recordedAt) },
    {
      label: "Status",
      value: <StatusBadge variant={statusBadgeVariant(meta.status)}>{meta.statusLabel}</StatusBadge>,
    },
  ];
  if (meta.externalId) {
    rows.splice(1, 0, {
      label: copy.partnerResponseExternalIdLabel,
      value: <span className="font-mono text-caption">{meta.externalId}</span>,
    });
  }
  if (meta.httpStatus != null) {
    rows.push({ label: copy.partnerResponseHttpLabel, value: String(meta.httpStatus) });
  }
  return rows;
}

export function buildIfscSummaryMetaRows(
  summary: SupportKycIfscLookupSummary,
): ClientKycPayloadMetaRow[] {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const location = [summary.city, summary.state].filter(Boolean).join(", ");
  return [
    { label: copy.ifscFieldIfsc, value: <span className="font-mono">{summary.ifscCode}</span> },
    { label: copy.ifscFieldBank, value: summary.bankName },
    { label: copy.ifscFieldBranch, value: summary.branchLabel },
    ...(location ? [{ label: copy.ifscFieldLocation, value: location }] : []),
  ];
}
