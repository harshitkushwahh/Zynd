"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { fetchAuthSecurityPolicy } from "@/features/account/api/mfa-api";
import { ProfileStatusBadge } from "@/features/dashboard/overview/components/overview-profile-status-badge";
import { getKycStepFormMeta } from "@/features/kyc/lib/kyc-step-form-meta";
import { initialsFromName } from "@/features/referral/lib/referral-initials";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewProfileCardProps = {
  className?: string;
};

/** Light: soft whitish blue→emerald wash. Dark (no photo): deep blue→emerald on dark surface. */
const PROFILE_CARD_BRAND_BG_CLASS =
  "bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_14%,transparent)_0%,transparent_100%),linear-gradient(135deg,color-mix(in_srgb,var(--zynd-blue)_16%,white)_0%,color-mix(in_srgb,var(--zynd-emerald)_14%,white)_100%)] dark:bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_26%,transparent)_0%,transparent_100%),linear-gradient(135deg,color-mix(in_srgb,var(--zynd-blue)_48%,var(--zynd-dark-surface))_0%,color-mix(in_srgb,var(--zynd-emerald)_34%,var(--zynd-dark-bg))_100%)]";

const PROFILE_INITIALS_BG_CLASS =
  "bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)_0%,transparent_100%),linear-gradient(135deg,var(--zynd-blue)_0%,var(--zynd-emerald)_100%)] text-primary-foreground ring-1 ring-white/35";

const PROFILE_FOOTER_CLASS =
  "border border-white/45 bg-white/42 backdrop-blur-sm dark:border-white/12 dark:bg-black/30";

/** Name and subtitle: dark on light footer in light mode, white on dark footer in dark mode. */
const PROFILE_FOOTER_NAME_CLASS = "text-zinc-900 dark:text-white";
const PROFILE_FOOTER_SUBTITLE_CLASS = "text-zinc-600 dark:text-white/75";

function useProfileMfaTooltip() {
  const { user } = useAuth();
  const overview = copy.dashboard.overview;
  const mfaComplete = Boolean(user?.mfa_enrolled);
  const phoneVerified = Boolean(user?.phone_verified_at);
  const [smsFallbackEnabled, setSmsFallbackEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!mfaComplete) {
      setSmsFallbackEnabled(null);
      return;
    }

    let cancelled = false;
    void fetchAuthSecurityPolicy()
      .then((policy) => {
        if (!cancelled) {
          setSmsFallbackEnabled(Boolean(policy.step_up_sms_fallback_enabled));
        }
      })
      .catch(() => {
        if (!cancelled) setSmsFallbackEnabled(null);
      });

    return () => {
      cancelled = true;
    };
  }, [mfaComplete]);

  return useMemo(() => {
    if (!mfaComplete) {
      return {
        complete: false,
        title: overview.profileMfaTooltipPendingTitle,
        detail: overview.profileMfaTooltipPending,
        href: "/dashboard/settings?section=security" as const,
      };
    }

    let detail = overview.profileMfaTooltipComplete;
    if (smsFallbackEnabled && phoneVerified) {
      detail = `${detail} ${overview.profileMfaTooltipCompleteSms}`;
    }

    return {
      complete: true,
      title: overview.profileMfaTooltipCompleteTitle,
      detail,
      href: "/dashboard/settings?section=security" as const,
    };
  }, [mfaComplete, overview, phoneVerified, smsFallbackEnabled]);
}

export function OverviewProfileCard({ className }: OverviewProfileCardProps) {
  const { displayName, user } = useAuth();
  const { profileUrl, loading } = useProfileImage();
  const kyc = useKycOptional();
  const mfaTooltip = useProfileMfaTooltip();
  const name = displayName || user?.email || "User";
  const initials = initialsFromName(name);
  const overview = copy.dashboard.overview;
  const hasPhoto = Boolean(profileUrl);

  const kycComplete = kyc?.status === "complete";
  const kycProgress = kyc?.profileProgress;
  const kycAllowed = kyc?.kycAllowed ?? false;

  const kycStepIcon = kycProgress
    ? getKycStepFormMeta(kycProgress.activeStepId).icon
    : getKycStepFormMeta("pan-card").icon;

  const kycTooltip = kycComplete && kycProgress
    ? {
        title: kycProgress.tooltipTitle,
        detail: kycProgress.tooltipDetail,
      }
    : !kycAllowed
      ? {
          title: overview.profileKycTooltipBlockedTitle,
          detail: overview.profileKycTooltipBlocked,
        }
      : kycProgress
        ? {
            title: kycProgress.tooltipTitle,
            detail: kycProgress.tooltipDetail,
          }
        : {
            title: overview.profileKycTooltipPendingTitle,
            detail: overview.profileKycTooltipPending,
          };

  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full min-h-[13.5rem] max-w-[14rem] overflow-hidden rounded-[1.75rem]",
        PROFILE_CARD_BRAND_BG_CLASS,
        className,
      )}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profileUrl!} alt="" className="absolute inset-0 size-full object-cover object-top" />
      ) : null}

      {!hasPhoto ? (
        <div className="absolute inset-x-0 top-0 flex justify-center pb-24 pt-8">
          {loading ? (
            <Skeleton className="size-20 rounded-full bg-white/40" />
          ) : (
            <div
              className={cn(
                "flex size-20 items-center justify-center rounded-full text-h4 font-semibold shadow-sm",
                PROFILE_INITIALS_BG_CLASS,
              )}
            >
              {initials}
            </div>
          )}
        </div>
      ) : null}

      {hasPhoto ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/75 via-white/15 to-transparent dark:from-white/55 dark:via-white/10 dark:to-transparent" />
      ) : null}

      <div
        className={cn(
          "absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-2.5",
          PROFILE_FOOTER_CLASS,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-compact font-semibold", PROFILE_FOOTER_NAME_CLASS)}>{name}</p>
          <p className={cn("mt-0.5 truncate text-caption", PROFILE_FOOTER_SUBTITLE_CLASS)}>
            {overview.profileSubtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProfileStatusBadge
            onClick={kycAllowed ? () => kyc?.openDialog() : undefined}
            ariaLabel={kycTooltip.title}
            tooltipTitle={kycTooltip.title}
            tooltipDetail={kycTooltip.detail}
            complete={kycComplete}
            ring={{
              progressFraction: kycProgress?.progressFraction ?? 0,
              tone: kycProgress?.tone ?? "muted",
              icon: kycStepIcon,
              complete: kycComplete,
              submitted: kycProgress?.overallStatus === "submitted",
            }}
          />
          <ProfileStatusBadge
            href={mfaTooltip.href}
            ariaLabel={mfaTooltip.title}
            tooltipTitle={mfaTooltip.title}
            tooltipDetail={mfaTooltip.detail}
            complete={mfaTooltip.complete}
            ring={{
              progressFraction: mfaTooltip.complete ? 1 : 0,
              tone: mfaTooltip.complete ? "success" : "warning",
              icon: ShieldCheck,
              complete: mfaTooltip.complete,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function OverviewProfileCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full min-h-[13.5rem] max-w-[14rem] overflow-hidden rounded-[1.75rem]",
        PROFILE_CARD_BRAND_BG_CLASS,
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 top-0 flex justify-center pb-24 pt-8">
        <Skeleton className="size-20 rounded-full bg-white/40" />
      </div>
      <div
        className={cn(
          "absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-2.5",
          PROFILE_FOOTER_CLASS,
        )}
      >
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28 bg-zinc-900/10" />
          <Skeleton className="h-3 w-14 bg-zinc-600/15" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-full bg-white/50" />
          <Skeleton className="size-9 rounded-full bg-white/50" />
        </div>
      </div>
    </div>
  );
}
