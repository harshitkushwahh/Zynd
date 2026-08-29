"use client";

import { useCallback, useState } from "react";
import { CalendarDays, Check, Copy, FileText, Landmark, RefreshCw, ShieldCheck, UserRound } from "lucide-react";

import { AdminMetricCard, type AdminMetricCardTone } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserKycDetail } from "@/lib/admin-api";
import { isAdminKycKraPath } from "@/lib/admin-user-kyc-steps";
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
  const normalized = value.trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";
  return normalized.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

function profilePageTone(
  kind: "investor" | "mf",
  status: string | null | undefined,
  hasId: boolean,
): AdminMetricCardTone {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "failed") return "warning";
  if (!hasId) return "muted";
  if (normalized === "active") return kind === "mf" ? "success" : "info";
  return kind === "mf" ? "success" : "info";
}

function iconToneClass(tone: AdminMetricCardTone) {
  if (tone === "success") return "admin-metric-card__icon--success";
  if (tone === "warning") return "admin-metric-card__icon--warning";
  if (tone === "info") return "admin-metric-card__icon--info";
  if (tone === "muted") return "admin-metric-card__icon--muted";
  return "admin-metric-card__icon--default";
}

function AdminUserKycProfileIdInlineCopy({
  prefix,
  value,
  showPrefix = true,
}: {
  prefix: string;
  value: string;
  showPrefix?: boolean;
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
      {showPrefix ? (
        <span className="admin-user-kyc-overview__profile-copy-prefix">{prefix}</span>
      ) : null}
      <span className="font-mono">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}

type ProfilePage = {
  id: string;
  label: string;
  statusLabel: string;
  profileId: string | null;
  tone: AdminMetricCardTone;
  icon: typeof UserRound;
};

function buildProfilePages(kyc: AdminUserKycDetail): ProfilePage[] {
  const investorId = kyc.investor_profile_id?.trim() || null;
  const mfId = kyc.mf_investment_profile_id?.trim() || null;
  const pages: ProfilePage[] = [];

  if (investorId || kyc.investor_profile_status) {
    pages.push({
      id: "investor",
      label: "Investor",
      statusLabel: investorId ? shortProfileStatus(kyc.investor_profile_status) : "Not provisioned",
      profileId: investorId,
      tone: profilePageTone("investor", kyc.investor_profile_status, Boolean(investorId)),
      icon: UserRound,
    });
  }

  if (mfId || kyc.mf_investment_profile_status) {
    pages.push({
      id: "mf",
      label: "MF account",
      statusLabel: mfId ? shortProfileStatus(kyc.mf_investment_profile_status) : "Not provisioned",
      profileId: mfId,
      tone: profilePageTone("mf", kyc.mf_investment_profile_status, Boolean(mfId)),
      icon: Landmark,
    });
  }

  if (pages.length === 0) {
    pages.push({
      id: "empty",
      label: "Profiles",
      statusLabel: "Not provisioned",
      profileId: null,
      tone: "muted",
      icon: UserRound,
    });
  }

  return pages;
}

function ProfilesMetricCard({ kyc }: { kyc: AdminUserKycDetail }) {
  const pages = buildProfilePages(kyc);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, pages.length - 1);
  const page = pages[safeIndex] ?? pages[0];
  const PageIcon = page.icon;
  const nextPage = pages[(safeIndex + 1) % pages.length];

  const switchPage = useCallback(() => {
    setActiveIndex((current) => (current + 1) % pages.length);
  }, [pages.length]);

  return (
    <div className="admin-metric-card-outer">
      <Card className="admin-metric-card admin-metric-card--overview relative h-full ring-0">
        <CardContent className="admin-metric-card__body admin-metric-card__body--overview">
          <div className="admin-user-kyc-overview__profile-head">
            <div className={cn("admin-metric-card__icon", iconToneClass(page.tone))}>
              <PageIcon className="size-4" strokeWidth={2.25} />
            </div>
            {pages.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="admin-user-kyc-overview__profile-switch"
                onClick={switchPage}
                aria-label={`Switch to ${nextPage.label}`}
              >
                <RefreshCw className="size-3.5" strokeWidth={2.25} />
              </Button>
            ) : null}
          </div>
          <div className="admin-metric-card__overview-main">
            <div className="admin-metric-card__overview-value">{page.statusLabel}</div>
            <p className="admin-metric-card__overview-label">{page.label}</p>
            {page.profileId ? (
              <AdminUserKycProfileIdInlineCopy prefix={page.label} value={page.profileId} showPrefix={false} />
            ) : (
              <p className="admin-metric-card__overview-hint">Cybrilla external IDs</p>
            )}
            {pages.length > 1 ? (
              <div className="admin-user-kyc-overview__profile-dots" role="tablist" aria-label="Profile pages">
                {pages.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === safeIndex}
                    aria-label={`${item.label} ${index + 1} of ${pages.length}`}
                    className={
                      index === safeIndex
                        ? "admin-user-kyc-carousel-dots__dot admin-user-kyc-carousel-dots__dot--active"
                        : "admin-user-kyc-carousel-dots__dot"
                    }
                    onClick={() => setActiveIndex(index)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminUserKycOverviewMetrics({ kyc, className }: AdminUserKycOverviewMetricsProps) {
  const kycInitiatedAt = kyc.kyc_initiated_at ?? null;

  const verificationValue = `PAN ${shortVerificationStatus(kyc.pan_verification_status)} · Bank ${shortVerificationStatus(kyc.bank_verification_status)}`;

  const journeyValue = kycInitiatedAt
    ? formatTimestampDetail(kycInitiatedAt).split(",")[0]
    : "Not started";

  return (
    <AdminMetricCardsGrid columns="four" className={cn("admin-user-kyc-overview", className)}>
      <AdminMetricCard
        accent
        icon={FileText}
        label="Documents uploaded"
        value={String(kyc.documents.length)}
        hint={
          kyc.documents.length > 0
            ? "Ready for review"
            : isAdminKycKraPath(kyc)
              ? "Not required for KRA path"
              : "No files yet"
        }
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
      <ProfilesMetricCard kyc={kyc} />
    </AdminMetricCardsGrid>
  );
}
