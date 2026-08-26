"use client";

import { useCallback, useState } from "react";
import { CalendarDays, Check, Copy, FileText, ShieldCheck, UserRound } from "lucide-react";

import { AdminMetricCard, type AdminMetricCardTone } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import type { AdminUserKycDetail } from "@/lib/admin-api";
import { formatTimestampDetail } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type AdminUserKycOverviewMetricsProps = {
  kyc: AdminUserKycDetail;
  className?: string;
};

function shortVerificationStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  if (value === "verified") return "Verified";
  if (value === "failed") return "Failed";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortProfileStatus(value: string | null | undefined) {
  if (!value) return "Not provisioned";
  if (value === "active") return "Active";
  if (value === "pending") return "Pending";
  if (value === "failed") return "Failed";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function verificationMetricTone(
  panStatus: string | null | undefined,
  bankStatus: string | null | undefined,
): AdminMetricCardTone {
  if (panStatus === "failed" || bankStatus === "failed") return "warning";
  if (panStatus === "verified" && bankStatus === "verified") return "success";
  return "muted";
}

function journeyMetricTone(kyc: AdminUserKycDetail): AdminMetricCardTone {
  if (kyc.overall_status === "completed") return "success";
  if (kyc.overall_status === "submitted") return "warning";
  if (kyc.kyc_already_registered) return "success";
  return "muted";
}

function profilesMetricTone(kyc: AdminUserKycDetail): AdminMetricCardTone {
  const investorActive = kyc.investor_profile_status === "active" && Boolean(kyc.investor_profile_id);
  const mfActive =
    kyc.mf_investment_profile_status === "active" && Boolean(kyc.mf_investment_profile_id);

  if (investorActive && mfActive) return "success";
  if (kyc.investor_profile_status === "failed" || kyc.mf_investment_profile_status === "failed") {
    return "warning";
  }
  if (kyc.investor_profile_id || kyc.mf_investment_profile_id) return "info";
  return "muted";
}

function AdminUserKycProfileIdInlineCopy({
  prefix,
  value,
}: {
  prefix: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      className="admin-user-kyc-overview__profile-copy admin-user-kyc-overview__profile-copy--inline"
      onClick={() => void onCopy()}
      aria-label={copied ? `${prefix} ID copied` : `Copy ${prefix} ID ${value}`}
    >
      <span className="admin-user-kyc-overview__profile-copy-prefix">{prefix}</span>
      <span className="font-mono">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}

function formatProfileSummary(kyc: AdminUserKycDetail) {
  const investorText = kyc.investor_profile_id?.trim()
    ? shortProfileStatus(kyc.investor_profile_status)
    : "Not provisioned";
  const mfText = kyc.mf_investment_profile_id?.trim()
    ? shortProfileStatus(kyc.mf_investment_profile_status)
    : "Not provisioned";

  return `Investor ${investorText} · MF ${mfText}`;
}

function renderProfilesHint(kyc: AdminUserKycDetail) {
  const investorId = kyc.investor_profile_id?.trim() ?? "";
  const mfId = kyc.mf_investment_profile_id?.trim() ?? "";

  if (!investorId && !mfId) {
    return "Cybrilla external IDs";
  }

  return (
    <span className="admin-user-kyc-overview__profile-ids-hint">
      {investorId ? <AdminUserKycProfileIdInlineCopy prefix="Investor" value={investorId} /> : null}
      {investorId && mfId ? (
        <span className="admin-user-kyc-overview__profile-ids-separator" aria-hidden>
          ·
        </span>
      ) : null}
      {mfId ? <AdminUserKycProfileIdInlineCopy prefix="MF" value={mfId} /> : null}
    </span>
  );
}

export function AdminUserKycOverviewMetrics({ kyc, className }: AdminUserKycOverviewMetricsProps) {
  const kycInitiatedAt = kyc.kyc_initiated_at ?? null;

  const verificationValue = `PAN ${shortVerificationStatus(kyc.pan_verification_status)} · Bank ${shortVerificationStatus(kyc.bank_verification_status)}`;

  const journeyValue = kycInitiatedAt
    ? formatTimestampDetail(kycInitiatedAt).split(",")[0]
    : "Not started";

  const profilesValue = formatProfileSummary(kyc);
  const profilesHint = renderProfilesHint(kyc);

  return (
    <AdminMetricCardsGrid columns="four" className={cn("admin-user-kyc-overview", className)}>
      <AdminMetricCard
        accent
        icon={FileText}
        label="Documents uploaded"
        value={String(kyc.documents.length)}
        hint={kyc.documents.length > 0 ? "Ready for review" : "No files yet"}
        tone={kyc.documents.length > 0 ? "success" : "muted"}
      />
      <AdminMetricCard
        icon={ShieldCheck}
        label="Verification"
        value={verificationValue}
        hint="PAN & bank checks"
        tone={verificationMetricTone(kyc.pan_verification_status, kyc.bank_verification_status)}
      />
      <AdminMetricCard
        icon={CalendarDays}
        label="Journey"
        value={journeyValue}
        tone={journeyMetricTone(kyc)}
      />
      <AdminMetricCard
        icon={UserRound}
        label="Profiles"
        value={profilesValue}
        hint={profilesHint}
        tone={profilesMetricTone(kyc)}
      />
    </AdminMetricCardsGrid>
  );
}
