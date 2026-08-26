"use client";

import { useEffect } from "react";
import { PartyPopper } from "lucide-react";

import { fireInviteSuccessConfetti } from "@/lib/invite-success-confetti";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type DistributorInviteDoneCardProps = {
  title?: string;
  subtitle?: string;
};

export function DistributorInviteDoneCard({
  title = "You're all set",
  subtitle,
}: DistributorInviteDoneCardProps) {
  const resolvedSubtitle =
    subtitle ?? `Your ${ZYND_MITRA_COPY.consoleName} access is ready.`;

  useEffect(() => {
    fireInviteSuccessConfetti();
  }, []);

  return (
    <div className="distributor-invite-done-card">
      <div className="distributor-invite-done-card__icon-wrap" aria-hidden="true">
        <PartyPopper className="distributor-invite-done-card__icon" strokeWidth={2} />
      </div>
      <h2 className="distributor-invite-done-card__title">{title}</h2>
      <p className="distributor-invite-done-card__subtitle">{resolvedSubtitle}</p>
    </div>
  );
}
