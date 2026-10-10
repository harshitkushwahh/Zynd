"use client";

import { useMemo } from "react";

import { ClientProfileCapturedDetailsTable } from "@/components/clients/client-profile-captured-details-table";
import { ClientProfileCapturedSummaryCards } from "@/components/clients/client-profile-captured-summary-cards";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientProfile } from "@/lib/distributor-types";
import { buildSupportClientCapturedProfile } from "@/lib/support-client-captured-profile-dummy-data";
import { cn } from "@/lib/utils";

type ClientProfileTabPanelProps = {
  profile: DistributorClientProfile;
  className?: string;
};

export function ClientProfileTabPanel({ profile, className }: ClientProfileTabPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.capturedProfile;

  const captured = useMemo(
    () => profile.capturedProfile ?? buildSupportClientCapturedProfile(profile),
    [profile],
  );

  return (
    <div className={cn("support-client-profile-tab", className)}>
      <ClientProfileCapturedSummaryCards captured={captured} />

      <section className="support-client-profile-tab__details-shell">
        <header className="support-client-profile-tab__details-header">
          <h3 className="support-client-profile-tab__details-title">{copy.detailsTitle}</h3>
          <p className="support-client-profile-tab__details-description">{copy.detailsDescription}</p>
        </header>
        <ClientProfileCapturedDetailsTable rows={captured.detailRows} />
      </section>
    </div>
  );
}
