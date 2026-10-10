"use client";

import { Briefcase, UserRound, Users } from "lucide-react";

import { ClientKycRegistryRecordCard } from "@/components/clients/client-kyc-registry-record-card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { SupportClientKycRegistrySnapshot } from "@/lib/support-client-kyc-registry-model";
import { cn } from "@/lib/utils";

const RECORD_ICONS = {
  mf_investment_account: Briefcase,
  nominee: Users,
  investor_profile: UserRound,
} as const;

type ClientKycRegistryPanelProps = {
  snapshot: SupportClientKycRegistrySnapshot;
  className?: string;
};

export function ClientKycRegistryPanel({ snapshot, className }: ClientKycRegistryPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;

  return (
    <section className={cn("support-client-kyc-registry", className)}>
      <h2 className="support-client-kyc-registry__section-title">{copy.registrySectionTitle}</h2>
      <div className="support-client-kyc-registry__grid">
        {snapshot.records.map((record) => {
          const Icon = RECORD_ICONS[record.id];
          return <ClientKycRegistryRecordCard key={record.id} record={record} icon={Icon} />;
        })}
      </div>
    </section>
  );
}
