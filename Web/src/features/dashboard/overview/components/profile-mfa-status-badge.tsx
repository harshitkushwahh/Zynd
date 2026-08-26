"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  ProfileMfaStatusPopoverCard,
  type ProfileMfaStatusPopoverState,
} from "@/features/dashboard/overview/components/profile-mfa-status-popover-card";
import { ProfileProgressRing } from "@/features/dashboard/overview/components/overview-profile-status-badge";
import { cn } from "@/lib/utils";

type ProfileMfaStatusBadgeProps = {
  ariaLabel: string;
  href: string;
  state: ProfileMfaStatusPopoverState;
};

export function ProfileMfaStatusBadge({ ariaLabel, href, state }: ProfileMfaStatusBadgeProps) {
  const { complete } = state;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={280}
        render={
          <Link
            href={href}
            className={cn(
              "inline-flex shrink-0 rounded-full outline-none transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label={ariaLabel}
          />
        }
      >
        <ProfileProgressRing
          progressFraction={complete ? 1 : 0}
          tone={complete ? "success" : "warning"}
          icon={ShieldCheck}
          complete={complete}
        />
      </HoverCardTrigger>

      <HoverCardContent
        side="top"
        align="center"
        sideOffset={10}
        className="w-52 rounded-[1.25rem] p-0"
      >
        <ProfileMfaStatusPopoverCard state={state} href={href} />
      </HoverCardContent>
    </HoverCard>
  );
}
