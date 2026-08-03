"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { initialsFromName } from "@/features/referral/lib/referral-initials";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewProfileCardProps = {
  className?: string;
};

/** Soft whitish blue→emerald wash — same brand pairing as the AI bot surface. */
const PROFILE_CARD_BRAND_BG_CLASS =
  "bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_14%,transparent)_0%,transparent_100%),linear-gradient(135deg,color-mix(in_srgb,var(--zynd-blue)_16%,white)_0%,color-mix(in_srgb,var(--zynd-emerald)_14%,white)_100%)] dark:bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_18%,transparent)_0%,transparent_100%),linear-gradient(135deg,color-mix(in_srgb,var(--zynd-blue)_22%,white)_0%,color-mix(in_srgb,var(--zynd-emerald)_18%,white)_100%)]";

const PROFILE_INITIALS_BG_CLASS =
  "bg-[radial-gradient(65%_65%_at_50%_100%,color-mix(in_srgb,var(--zynd-emerald)_55%,transparent)_0%,transparent_100%),linear-gradient(135deg,var(--zynd-blue)_0%,var(--zynd-emerald)_100%)] text-primary-foreground ring-1 ring-white/35";

const PROFILE_FOOTER_CLASS =
  "border border-white/45 bg-white/42 backdrop-blur-sm dark:border-white/20 dark:bg-white/14";

function ProfileStatusCircle({
  complete,
  children,
  tooltip,
  href,
  filled = false,
}: {
  complete: boolean;
  children: ReactNode;
  tooltip: string;
  href?: string;
  filled?: boolean;
}) {
  const circleClass = cn(
    "flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    href
      ? "cursor-pointer transition-transform hover:scale-105 active:scale-95"
      : "cursor-default",
    filled
      ? complete
        ? "bg-success text-white"
        : "bg-warning text-white"
      : complete
        ? "bg-white text-success ring-2 ring-success/25"
        : "bg-white text-warning ring-2 ring-warning/35",
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Link href={href} aria-label={tooltip} className={circleClass}>
              {children}
            </Link>
          ) : (
            <button type="button" aria-label={tooltip} className={circleClass}>
              {children}
            </button>
          )
        }
      />
      <TooltipContent side="top" className="max-w-[14rem] text-center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function OverviewProfileCard({ className }: OverviewProfileCardProps) {
  const { displayName, user } = useAuth();
  const { profileUrl, loading } = useProfileImage();
  const kyc = useKycOptional();
  const name = displayName || user?.email || "User";
  const initials = initialsFromName(name);
  const overview = copy.dashboard.overview;
  const kycComplete = kyc?.status === "complete";
  const mfaComplete = Boolean(user?.mfa_enrolled);
  const hasPhoto = Boolean(profileUrl);

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
          <p className="truncate text-compact font-semibold text-foreground">{name}</p>
          <p className="mt-0.5 truncate text-caption text-muted-foreground">
            {overview.profileSubtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProfileStatusCircle
            complete={kycComplete}
            href="/dashboard/kyc"
            tooltip={
              kycComplete
                ? overview.profileKycTooltipComplete
                : overview.profileKycTooltipPending
            }
          >
            <span className="text-[9px] font-bold uppercase tracking-wide">
              {overview.profileKycLabel}
            </span>
          </ProfileStatusCircle>
          <ProfileStatusCircle
            complete={mfaComplete}
            filled
            href={mfaComplete ? "/dashboard/settings?section=mfa" : undefined}
            tooltip={
              mfaComplete
                ? overview.profileMfaTooltipComplete
                : overview.profileMfaTooltipPending
            }
          >
            <ShieldCheck className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </ProfileStatusCircle>
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
          <Skeleton className="h-4 w-28 bg-foreground/10" />
          <Skeleton className="h-3 w-14 bg-foreground/8" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-full bg-white/50" />
          <Skeleton className="size-9 rounded-full bg-white/50" />
        </div>
      </div>
    </div>
  );
}
