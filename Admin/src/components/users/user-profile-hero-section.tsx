"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Copy, Lock, ShieldCheck } from "lucide-react";

import { AdminGrowthBadge } from "@/components/ui/admin-growth-badge";
import { Button } from "@/components/ui/button";
import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { RiskProfileTierBadge } from "@/components/risk-profile/risk-profile-tier-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminUserProfileAvatar } from "@/components/users/admin-user-profile-avatar";
import {
  MfaStatusBadge,
  PlatformRoleBadge,
  UserStatusBadge,
} from "@/components/users/user-status-badge";
import type { AdminUserInvestmentsDetail, AdminUserKycDetail, AdminUserProfileDetail, AdminUserSummary } from "@/lib/admin-api";
import {
  computeAdminKycProgress,
  resolveKycHeroComplianceBadge,
} from "@/lib/admin-user-kyc-progress";
import { resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { useAdminUserRiskProfileQuery } from "@/hooks/use-admin-user-risk-profile-query";
import type { UserRiskProfileDetail } from "@/lib/risk-profile-admin-api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type UserProfileHeroSectionProps = {
  summary: AdminUserSummary;
  profileDetail: AdminUserProfileDetail | null;
  canReadMf: boolean;
  canReadKyc: boolean;
  canReadRiskProfile: boolean;
  isPlatformAdmin?: boolean;
  identityActions?: React.ReactNode;
  onOpenPortfolioTab?: () => void;
  onOpenRiskTab?: () => void;
};

const USER_PROFILE_HERO_DUMMY_RISK = {
  tier: "moderate",
  score: 420,
  label: "Moderate",
} as const;

function UserProfileHeroCardLockOverlay() {
  return (
    <div className="admin-user-profile-hero__card-lock" aria-hidden>
      <Lock className="size-4" strokeWidth={2.25} />
    </div>
  );
}

function UserProfileHeroRiskPreview({
  tier,
  score,
  label,
  muted = false,
}: {
  tier: string;
  score: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "admin-user-profile-hero__risk-card-layout",
        muted && "admin-user-profile-hero__risk-card-layout--muted",
      )}
    >
      <div className="admin-user-profile-hero__risk-gauge-wrap">
        <RiskProfileGauge score={score} tier={tier} size="mini" />
      </div>
      <div className="admin-user-profile-hero__risk-card-meta">
        <RiskProfileTierBadge tier={tier} label={label} />
        <div className="admin-user-profile-hero__risk-score-box">
          <p className="admin-user-profile-hero__risk-score tabular-nums">
            <span className="admin-user-profile-hero__risk-score-value">{score}</span>
            <span className="admin-user-profile-hero__risk-score-denom">/1000</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function formatInr(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sumHoldingsValue(holdings: AdminUserInvestmentsDetail["holdings"]) {
  return holdings.reduce((total, holding) => {
    const amount = Number(holding.market_value_inr);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

function countActiveSips(plans: AdminUserInvestmentsDetail["sip_plans"]) {
  return plans.filter((plan) => String(plan.status ?? "").toLowerCase() === "active").length;
}

function sumPurchaseCost(purchases: AdminUserInvestmentsDetail["purchases"]) {
  return purchases.reduce((total, order) => {
    const amount = Number(order.amount_inr);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

function computePortfolioHeroStats(investments: AdminUserInvestmentsDetail) {
  const currentValue = sumHoldingsValue(investments.holdings);
  const investedCost = sumPurchaseCost(investments.purchases);
  const gainAmount = investedCost > 0 ? currentValue - investedCost : 0;
  const gainPct = investedCost > 0 ? (gainAmount / investedCost) * 100 : 0;

  return {
    currentValue,
    gainPct,
    sipCount: investments.sip_plans.length,
    activeSipCount: countActiveSips(investments.sip_plans),
  };
}

function UserProfileHeroPortfolioCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-metric-card-outer admin-user-profile-hero__portfolio-card-outer">
      <Card className="admin-metric-card admin-metric-card--overview admin-metric-card--overview-accent h-full ring-0">
        <CardContent className="admin-user-profile-hero__portfolio-card-body">{children}</CardContent>
      </Card>
    </div>
  );
}

function formatIdentityPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return null;

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }

  return phone.trim();
}

function resolveIdentityDisplayName(
  summary: AdminUserSummary,
  profileDetail: AdminUserProfileDetail | null,
) {
  const kycName = profileDetail?.kyc?.pan?.full_name?.trim();
  if (kycName) return kycName;
  return summary.display_name;
}

function UserProfileHeroClientIdCopy({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clientId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [clientId]);

  return (
    <button
      type="button"
      className="admin-user-profile-hero__identity-id-copy"
      onClick={() => void onCopy()}
      aria-label={copied ? "Zynd ID copied" : `Copy Zynd ID ${clientId}`}
    >
      <span className="font-mono">{clientId}</span>
      {copied ? (
        <Check className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}

function UserProfileHeroPortfolioCard({
  canReadMf,
  investments,
  onOpenPortfolioTab,
}: {
  canReadMf: boolean;
  investments: AdminUserInvestmentsDetail | null;
  onOpenPortfolioTab?: () => void;
}) {
  const portfolioStats = useMemo(
    () => (investments ? computePortfolioHeroStats(investments) : null),
    [investments],
  );

  if (!canReadMf) {
    return (
      <UserProfileHeroPortfolioCardShell>
        <p className="admin-user-profile-hero__portfolio-empty">Restricted</p>
        <p className="admin-user-profile-hero__portfolio-empty-hint">No permission to view</p>
      </UserProfileHeroPortfolioCardShell>
    );
  }

  if (!investments || !portfolioStats) {
    return (
      <UserProfileHeroPortfolioCardShell>
        <p className="admin-user-profile-hero__portfolio-empty">Unavailable</p>
        <p className="admin-user-profile-hero__portfolio-empty-hint">Investment data not loaded</p>
      </UserProfileHeroPortfolioCardShell>
    );
  }

  const sipLabel =
    portfolioStats.sipCount === 1
      ? "1 SIP"
      : `${portfolioStats.sipCount} SIPs`;

  return (
    <UserProfileHeroPortfolioCardShell>
      <div className="admin-user-profile-hero__portfolio-card-head">
        <AdminGrowthBadge value={portfolioStats.gainPct} className="admin-growth-badge--on-accent" />
        {onOpenPortfolioTab ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="admin-user-profile-hero__portfolio-open-btn size-6"
            onClick={onOpenPortfolioTab}
            aria-label="Open portfolio tab"
          >
            <ArrowUpRight className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="admin-user-profile-hero__portfolio-main">
        <p className="admin-user-profile-hero__portfolio-value tabular-nums">
          {formatInr(portfolioStats.currentValue)}
        </p>
        <p className="admin-user-profile-hero__portfolio-label">Invested amount</p>
        {portfolioStats.sipCount > 0 ? (
          <span className="admin-user-profile-hero__portfolio-sip-badge">{sipLabel}</span>
        ) : null}
      </div>
    </UserProfileHeroPortfolioCardShell>
  );
}

function kycIconToneClass(kyc: AdminUserKycDetail | null) {
  if (!kyc) return "admin-metric-card__icon--muted";
  if (kyc.overall_status === "completed") return "admin-metric-card__icon--success";
  if (kyc.overall_status === "in_progress") return "admin-metric-card__icon--info";
  return "admin-metric-card__icon--muted";
}

function UserProfileHeroKycCardShell({
  children,
  headBadge,
  iconTone = "admin-metric-card__icon--muted",
  locked = false,
}: {
  children: React.ReactNode;
  headBadge?: React.ReactNode;
  iconTone?: string;
  locked?: boolean;
}) {
  return (
    <div className="admin-metric-card-outer admin-user-profile-hero__kyc-card-outer">
      <Card className="admin-metric-card admin-metric-card--overview relative h-full ring-0">
        {locked ? <UserProfileHeroCardLockOverlay /> : null}
        <CardContent className="admin-user-profile-hero__kyc-card-body">
          <div className="admin-user-profile-hero__kyc-card-head">
            <div className={cn("admin-metric-card__icon shrink-0", iconTone)}>
              <ShieldCheck className="size-4" strokeWidth={2.25} />
            </div>
            {headBadge}
          </div>
          <div className="admin-user-profile-hero__kyc-card-content">{children}</div>
          <p className="admin-user-profile-hero__kyc-card-label">KYC</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UserProfileHeroKycCard({
  canReadKyc,
  kyc,
  locked = false,
}: {
  canReadKyc: boolean;
  kyc: AdminUserKycDetail | null;
  locked?: boolean;
}) {
  if (!canReadKyc) {
    return (
      <UserProfileHeroKycCardShell>
        <p className="text-compact text-muted-foreground">Restricted</p>
      </UserProfileHeroKycCardShell>
    );
  }

  if (!kyc) {
    return (
      <UserProfileHeroKycCardShell locked={locked}>
        <p className="text-compact text-muted-foreground">Unavailable</p>
      </UserProfileHeroKycCardShell>
    );
  }

  const complianceBadge = resolveKycHeroComplianceBadge(kyc);

  return (
    <UserProfileHeroKycCardShell
      locked={locked}
      iconTone={kycIconToneClass(kyc)}
      headBadge={<StatusBadge variant={complianceBadge.variant}>{complianceBadge.label}</StatusBadge>}
    >
      <UserProfileHeroKycValue kyc={kyc} />
    </UserProfileHeroKycCardShell>
  );
}

function UserProfileHeroKycValue({ kyc }: { kyc: AdminUserKycDetail }) {
  const { completed, total, percent } = computeAdminKycProgress(kyc);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedProgress(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  return (
    <div className="admin-user-profile-hero__kyc-value">
      <p className="admin-user-profile-hero__kyc-percent tabular-nums">{percent}%</p>
      <div
        className="admin-user-profile-hero__kyc-progress"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`KYC ${percent}% complete`}
      >
        <div
          className="admin-user-profile-hero__kyc-progress-fill"
          style={{ width: `${animatedProgress}%` }}
        />
      </div>
      <p className="admin-user-profile-hero__kyc-steps tabular-nums">
        {completed}/{total} steps
      </p>
    </div>
  );
}

function UserProfileHeroRiskCardShell({
  children,
  onOpenRiskTab,
  locked = false,
}: {
  children: React.ReactNode;
  onOpenRiskTab?: () => void;
  locked?: boolean;
}) {
  return (
    <div className="admin-metric-card-outer admin-user-profile-hero__risk-card-outer">
      <Card className="admin-metric-card admin-metric-card--overview relative h-full ring-0">
        {locked ? <UserProfileHeroCardLockOverlay /> : null}
        <CardContent className="admin-user-profile-hero__risk-card-body">
          <div className="admin-user-profile-hero__risk-card-head">
            <p className="admin-metric-card__overview-label">Risk profile</p>
            {onOpenRiskTab ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={onOpenRiskTab}
                aria-label="Open risk profile tab"
              >
                <ArrowUpRight className="size-3.5" />
              </Button>
            ) : null}
          </div>
          <div className="admin-user-profile-hero__risk-card-content">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserProfileHeroRiskCard({
  profile,
  showSkeleton,
  canReadRiskProfile,
  locked = false,
  onOpenRiskTab,
}: {
  profile: UserRiskProfileDetail | null;
  showSkeleton: boolean;
  canReadRiskProfile: boolean;
  locked?: boolean;
  onOpenRiskTab?: () => void;
}) {
  if (!canReadRiskProfile) {
    return (
      <UserProfileHeroRiskCardShell onOpenRiskTab={onOpenRiskTab}>
        <p className="text-center text-compact text-muted-foreground">Restricted</p>
        <p className="text-center text-caption text-muted-foreground">No permission to view</p>
      </UserProfileHeroRiskCardShell>
    );
  }

  if (showSkeleton) {
    return (
      <UserProfileHeroRiskCardShell onOpenRiskTab={onOpenRiskTab}>
        <div className="admin-user-profile-hero__risk-card-layout">
          <Skeleton className="h-14 w-[4.75rem] shrink-0 rounded-[var(--radius-control)]" />
          <div className="admin-user-profile-hero__risk-card-meta">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-[5.5rem] rounded-[var(--radius-control)]" />
          </div>
        </div>
      </UserProfileHeroRiskCardShell>
    );
  }

  if (!profile) {
    return (
      <UserProfileHeroRiskCardShell onOpenRiskTab={onOpenRiskTab} locked={locked}>
        <UserProfileHeroRiskPreview
          tier={USER_PROFILE_HERO_DUMMY_RISK.tier}
          score={USER_PROFILE_HERO_DUMMY_RISK.score}
          label={USER_PROFILE_HERO_DUMMY_RISK.label}
          muted
        />
      </UserProfileHeroRiskCardShell>
    );
  }

  const tierVisual = resolveRiskTierVisual(profile.tier);
  const tierLabel = profile.tier_config.title || tierVisual.label;

  return (
    <UserProfileHeroRiskCardShell onOpenRiskTab={onOpenRiskTab}>
      <UserProfileHeroRiskPreview
        tier={profile.tier}
        score={profile.score}
        label={tierLabel}
      />
    </UserProfileHeroRiskCardShell>
  );
}

export function UserProfileHeroSection({
  summary,
  profileDetail,
  canReadMf,
  canReadKyc,
  canReadRiskProfile,
  isPlatformAdmin = false,
  identityActions,
  onOpenPortfolioTab,
  onOpenRiskTab,
}: UserProfileHeroSectionProps) {
  const investments = profileDetail?.investments ?? null;
  const kyc = profileDetail?.kyc ?? null;
  const displayName = resolveIdentityDisplayName(summary, profileDetail);
  const formattedPhone = formatIdentityPhone(summary.phone);
  const { data: riskData, isPending: riskPending } = useAdminUserRiskProfileQuery(
    !isPlatformAdmin && canReadRiskProfile ? summary.user_id : "",
  );
  const riskProfile = riskData?.profile ?? null;
  const riskShowSkeleton = !isPlatformAdmin && canReadRiskProfile && riskPending && !riskData;
  const riskLocked = !isPlatformAdmin && canReadRiskProfile && !riskPending && !riskProfile;

  return (
    <section
      className={cn("admin-user-profile-hero", isPlatformAdmin && "admin-user-profile-hero--platform-admin")}
    >
      <Card className="admin-user-profile-hero__identity h-full ring-0">
        <CardContent className="admin-user-profile-hero__identity-body">
          <div className="admin-user-profile-hero__identity-main">
            <div className="admin-user-profile-hero__identity-avatar">
              <AdminUserProfileAvatar
                name={displayName}
                email={summary.email}
                imageSrc={summary.profile_image_url}
                size="lg"
                className="shrink-0"
              />
            </div>
            <div className="admin-user-profile-hero__identity-details">
              <div className="admin-user-profile-hero__identity-contact min-w-0">
                <h1 className="admin-user-profile-hero__identity-name truncate">{displayName}</h1>
                <p className="admin-user-profile-hero__identity-email truncate">{summary.email}</p>
                {formattedPhone ? (
                  <p className="admin-user-profile-hero__identity-phone tabular-nums">{formattedPhone}</p>
                ) : null}
                <UserProfileHeroClientIdCopy clientId={summary.client_id} />
              </div>
              <div className="admin-user-profile-hero__identity-badges">
                <PlatformRoleBadge role={summary.role} />
                <UserStatusBadge status={summary.status} />
                <MfaStatusBadge enabled={summary.mfa_enrolled} />
              </div>
            </div>
          </div>
          {identityActions ? (
            <div className="admin-user-profile-hero__identity-actions">{identityActions}</div>
          ) : null}
        </CardContent>
      </Card>

      {!isPlatformAdmin ? (
        <>
          <UserProfileHeroPortfolioCard
            canReadMf={canReadMf}
            investments={investments}
            onOpenPortfolioTab={onOpenPortfolioTab}
          />

          <UserProfileHeroKycCard canReadKyc={canReadKyc} kyc={kyc} locked={riskLocked} />

          <UserProfileHeroRiskCard
            profile={riskProfile}
            showSkeleton={riskShowSkeleton}
            canReadRiskProfile={canReadRiskProfile}
            locked={riskLocked}
            onOpenRiskTab={onOpenRiskTab}
          />
        </>
      ) : null}
    </section>
  );
}
