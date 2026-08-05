"use client";

import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy, Landmark, Mail, MapPin, Phone, UserCircle } from "lucide-react";

import {
  ClientPersonalInfoSwiperTile,
  type PersonalInfoSwiperSlide,
} from "@/components/clients/client-personal-info-swiper-tile";
import { Card, CardContent } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type {
  DistributorClientPersonalInfo,
  DistributorClientProfile,
} from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function ContactCopyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const copy = DISTRIBUTOR_CLIENT_COPY.identity;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      className="distributor-client-personal-info-account__contact-row"
      onClick={() => void handleCopy()}
      aria-label={copied ? copy.contactCopied(label) : copy.copyContact(label)}
    >
      <span className="distributor-client-personal-info-account__contact-icon" aria-hidden>
        <Icon strokeWidth={2.25} className="size-3.5" />
      </span>
      <span className="distributor-client-personal-info-account__contact-copy">
        <span className="distributor-client-personal-info-account__contact-value">{value}</span>
      </span>
      <span className="distributor-client-personal-info-account__contact-copy-action" aria-hidden>
        {copied ? (
          <Check strokeWidth={2.5} className="size-3.5 distributor-client-personal-info-account__contact-copy-icon--success" />
        ) : (
          <Copy strokeWidth={2.25} className="size-3.5" />
        )}
      </span>
    </button>
  );
}

function formatAddressStreet(
  address: DistributorClientPersonalInfo["addresses"][number],
): string {
  return [address.line1, address.line2].filter(Boolean).join(", ");
}

function formatAddressCityLine(
  address: DistributorClientPersonalInfo["addresses"][number],
): string {
  return [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
}

function bankSlideDetails(
  account: DistributorClientPersonalInfo["bankAccounts"][number],
): Pick<PersonalInfoSwiperSlide, "hint" | "ifscCode" | "accountType"> {
  return {
    hint: account.accountNumberMasked,
    ifscCode: account.ifscCode || undefined,
    accountType: account.accountType,
  };
}

type ClientPersonalInfoPanelProps = {
  profile: DistributorClientProfile;
  className?: string;
};

export function ClientPersonalInfoPanel({ profile, className }: ClientPersonalInfoPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.identity;
  const overview = DISTRIBUTOR_CLIENT_COPY.overview;
  const { investor, personalInfo } = profile;

  const accountMetaDate = formatDistributorDate(investor.createdAt);

  const bankSlides = personalInfo.bankAccounts.map((account) => ({
    id: account.id,
    value: account.bankName,
    ...bankSlideDetails(account),
  }));

  const addressSlides = personalInfo.addresses.map((address) => ({
    id: address.id,
    value: `${address.label} ${copy.addressTitle}`,
    hint: formatAddressStreet(address) || copy.valueNotAvailable,
    hintSecondary: formatAddressCityLine(address) || undefined,
    hintTertiary: address.country ?? undefined,
  }));

  return (
    <div className={cn("distributor-client-personal-info", className)}>
      <Card
        className={cn(
          "distributor-client-personal-info-account distributor-metric-card--tile distributor-metric-card--tile-accent h-full overflow-hidden rounded-[var(--radius-5xl)] ring-0",
        )}
      >
        <CardContent className="distributor-client-personal-info-account__body h-full">
          <header className="distributor-client-personal-info-account__header">
            <div className="distributor-client-personal-info-account__header-main">
              <span className="distributor-client-personal-info-account__avatar" aria-hidden>
                <UserCircle strokeWidth={2} className="size-5" />
              </span>
              <div className="distributor-client-personal-info-account__header-copy">
                <p className="distributor-client-personal-info-account__eyebrow">{copy.account}</p>
                <h3 className="distributor-client-personal-info-account__title">{profile.displayName}</h3>
              </div>
            </div>
            <span className="distributor-client-personal-info-account__member-badge">
              {overview.memberSince} · {accountMetaDate}
            </span>
          </header>

          <div className="distributor-client-personal-info-account__meta">
            <p className="distributor-client-personal-info-account__meta-line">
              {copy.pan}{" "}
              <span className="font-mono tracking-wide">{investor.panMasked}</span>
            </p>
          </div>

          <div className="distributor-client-personal-info-account__contact-panel">
            <ContactCopyRow icon={Mail} label={copy.email} value={profile.contactEmail} />
            <ContactCopyRow icon={Phone} label={copy.mobile} value={profile.contactPhone} />
          </div>
        </CardContent>
      </Card>

      <ClientPersonalInfoSwiperTile
        className="distributor-client-personal-info__tile"
        icon={Landmark}
        label=""
        slideLabel={copy.bankAccountsTitle}
        slides={bankSlides}
        emptySlide={{
          id: "bank-empty",
          value: "0",
          hint: copy.bankAccountsEmpty,
        }}
      />

      <ClientPersonalInfoSwiperTile
        className="distributor-client-personal-info__tile"
        icon={MapPin}
        label=""
        slideLabel={copy.addressTitle}
        slides={addressSlides}
        emptySlide={{
          id: "address-empty",
          value: "0",
          hint: copy.addressEmpty,
        }}
      />
    </div>
  );
}
