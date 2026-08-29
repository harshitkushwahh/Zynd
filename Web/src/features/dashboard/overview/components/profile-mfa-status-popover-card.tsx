"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { ProfilePopoverDetailLines } from "@/features/dashboard/overview/components/profile-popover-detail-lines";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type ProfileMfaStatusPopoverState = {
  complete: boolean;
  title: string;
  detailLines: readonly string[];
};

type ProfileMfaStatusPopoverCardProps = {
  state: ProfileMfaStatusPopoverState;
  href: string;
  className?: string;
};

export function ProfileMfaStatusPopoverCard({
  state,
  href,
  className,
}: ProfileMfaStatusPopoverCardProps) {
  const overview = copy.dashboard.overview;
  const { complete, title, detailLines } = state;
  const openAria = complete
    ? overview.profileMfaPopoverOpenEnabledAria
    : overview.profileMfaPopoverOpenDisabledAria;

  return (
    <Link
      href={href}
      className={cn(
        "group/popover relative block rounded-[inherit] outline-none transition-colors duration-200 hover:bg-muted/35 focus-visible:bg-muted/35",
        className,
      )}
      aria-label={openAria}
    >
      <ArrowUpRight
        className="absolute right-3 top-3 size-3.5 text-muted-foreground transition-colors duration-200 group-hover/popover:text-primary"
        aria-hidden
      />

      <div className="flex min-h-[8.75rem] flex-col items-center justify-center px-3.5 py-3.5 text-center">
        <div className="relative flex size-10 items-center justify-center">
          {complete ? (
            <>
              <span
                className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--success)_28%,white)_0%,color-mix(in_srgb,var(--success)_10%,transparent)_100%)] ring-1 ring-success/20"
                aria-hidden
              />
              <span className="relative flex size-7 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_2px_8px_color-mix(in_srgb,var(--success)_35%,transparent)] ring-2 ring-success/15 ring-offset-2 ring-offset-popover">
                <ShieldCheck className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            </>
          ) : (
            <>
              <span
                className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--warning)_24%,white)_0%,color-mix(in_srgb,var(--warning)_8%,transparent)_100%)] ring-1 ring-warning/20"
                aria-hidden
              />
              <span className="relative flex size-7 items-center justify-center rounded-full bg-white text-warning shadow-[0_2px_8px_color-mix(in_srgb,var(--warning)_18%,transparent)] ring-2 ring-warning/20 ring-offset-2 ring-offset-popover">
                <ShieldCheck className="size-3.5" strokeWidth={2.25} aria-hidden />
              </span>
            </>
          )}
        </div>

        <p className="mt-2 max-w-[10.5rem] text-compact font-semibold leading-snug text-foreground">
          {title}
        </p>
        <ProfilePopoverDetailLines lines={detailLines} className="[&_p]:text-[10px] [&_p]:leading-relaxed" />
      </div>
    </Link>
  );
}
