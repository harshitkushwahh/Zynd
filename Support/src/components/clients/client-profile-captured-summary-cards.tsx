"use client";

import { Building2, CreditCard, Mail, MapPin } from "lucide-react";

import { ClientProfileCapturedStructuredCard } from "@/components/clients/client-profile-captured-structured-card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { SupportClientCapturedProfile } from "@/lib/support-client-captured-profile-model";
import { cn } from "@/lib/utils";

type ClientProfileCapturedSummaryCardsProps = {
  captured: SupportClientCapturedProfile;
  className?: string;
};

export function ClientProfileCapturedSummaryCards({
  captured,
  className,
}: ClientProfileCapturedSummaryCardsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.capturedProfile.cards;
  const identityCopy = DISTRIBUTOR_CLIENT_COPY.identity;
  const { contact, identity, bankSlides, address } = captured;

  return (
    <div className={cn("support-client-profile-captured-summary", className)}>
      <ClientProfileCapturedStructuredCard
        icon={Mail}
        sectionLabel={copy.contact}
        fields={[
          { label: identityCopy.email, value: contact.emailMasked },
          { label: identityCopy.mobile, value: contact.mobileMasked, mono: true },
        ]}
      />

      <ClientProfileCapturedStructuredCard
        icon={CreditCard}
        sectionLabel={copy.identity}
        fields={[
          { label: copy.fullName, value: identity.legalFullName },
          { label: identityCopy.pan, value: identity.panMasked, mono: true },
          { label: copy.dateOfBirth, value: identity.dateOfBirth },
          { label: copy.panCategory, value: identity.panCategory },
        ]}
      />

      <ClientProfileCapturedStructuredCard
        icon={Building2}
        sectionLabel={copy.bank}
        slideVerified={bankSlides.map((slide) => Boolean(slide.verified))}
        slides={bankSlides}
        carouselAriaLabel={copy.bank}
      />

      <ClientProfileCapturedStructuredCard
        icon={MapPin}
        sectionLabel={copy.address}
        prefixFields={[
          {
            label: copy.permanentAddress,
            value: address.permanent.trim() || "Not captured",
            multiline: true,
          },
        ]}
        slides={address.correspondenceSlides}
        carouselAriaLabel={copy.correspondence}
      />
    </div>
  );
}
