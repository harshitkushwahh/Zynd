"use client";

import {
  Building2,
  Calendar,
  Hash,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Phone,
  PhoneOff,
  CircleOff,
  type LucideIcon,
} from "lucide-react";

import { ClientDetailEmptyState, isClientDetailValueEmpty } from "@/components/clients/client-detail-empty-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type {
  DistributorClientPersonalInfo,
  DistributorClientProfile,
} from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function PersonalInfoCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card shadow-sm">
      <div className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-compact font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

function FieldRow({
  label,
  value,
  icon: Icon,
  emptyIcon: EmptyIcon = CircleOff,
  mono = false,
  emptyLabel,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  emptyIcon?: LucideIcon;
  mono?: boolean;
  emptyLabel: string;
}) {
  const empty = isClientDetailValueEmpty(value);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-compact">
      <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 text-right font-medium",
          mono && !empty && "font-mono text-caption",
        )}
      >
        {empty ? (
          <span className="inline-flex items-center text-muted-foreground" title={emptyLabel}>
            <EmptyIcon className="size-4 opacity-55" aria-hidden />
            <span className="sr-only">{emptyLabel}</span>
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function formatAddressLine(
  address: DistributorClientPersonalInfo["addresses"][number],
): string {
  return [address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}

function OAuthProviderRow({
  label,
  connection,
  connectedLabel,
  notConnectedLabel,
}: {
  label: string;
  connection: DistributorClientPersonalInfo["connectedAccounts"]["google"];
  connectedLabel: string;
  notConnectedLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-compact">
      <span className="font-medium text-foreground">{label}</span>
      <div className="text-right">
        <StatusBadge variant={connection.connected ? "success" : "neutral"}>
          {connection.connected ? connectedLabel : notConnectedLabel}
        </StatusBadge>
        {connection.connected && connection.emailMasked ? (
          <p className="mt-1 text-caption text-muted-foreground">{connection.emailMasked}</p>
        ) : null}
      </div>
    </div>
  );
}

type ClientPersonalInfoPanelProps = {
  profile: DistributorClientProfile;
};

export function ClientPersonalInfoPanel({ profile }: ClientPersonalInfoPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.identity;
  const overview = DISTRIBUTOR_CLIENT_COPY.overview;
  const { investor, personalInfo } = profile;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PersonalInfoCard
        title={copy.account}
        description={copy.accountCardDescription}
        icon={Mail}
      >
        <dl className="divide-y divide-border">
          <FieldRow
            label={copy.email}
            value={profile.emailDisplay}
            icon={Mail}
            emptyLabel={copy.valueNotAvailable}
          />
          <FieldRow
            label={overview.zyndClientCode}
            value={investor.clientCode}
            icon={Hash}
            mono
            emptyLabel={copy.valueNotAvailable}
          />
          <FieldRow
            label={overview.memberSince}
            value={formatDistributorDate(investor.createdAt)}
            icon={Calendar}
            emptyLabel={copy.valueNotAvailable}
          />
          <FieldRow
            label={copy.pan}
            value={investor.panMasked}
            icon={IdCard}
            emptyIcon={CircleOff}
            mono
            emptyLabel={copy.valueNotAvailable}
          />
          <FieldRow
            label={copy.mobile}
            value={investor.mobileMasked}
            icon={Phone}
            emptyIcon={PhoneOff}
            emptyLabel={copy.valueNotAvailable}
          />
        </dl>
      </PersonalInfoCard>

      <PersonalInfoCard
        title={copy.bankAccountsTitle}
        description={copy.bankAccountsDescription}
        icon={Landmark}
      >
        {personalInfo.bankAccounts.length === 0 ? (
          <ClientDetailEmptyState message={copy.bankAccountsEmpty} icon={Landmark} />
        ) : (
          <ul className="divide-y divide-border">
            {personalInfo.bankAccounts.map((account) => (
              <li key={account.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-compact font-medium">{account.bankName}</p>
                    <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                      {account.accountNumberMasked} · {account.ifscCode}
                    </p>
                    {account.accountType ? (
                      <p className="text-caption text-muted-foreground">{account.accountType}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {account.isPrimary ? (
                      <StatusBadge variant="info">{copy.bankPrimary}</StatusBadge>
                    ) : null}
                    <StatusBadge
                      variant={
                        account.verificationStatus === "verified" ? "success" : "neutral"
                      }
                    >
                      {account.verificationStatus.replace(/_/g, " ")}
                    </StatusBadge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PersonalInfoCard>

      <PersonalInfoCard
        title={copy.addressTitle}
        description={copy.addressDescription}
        icon={MapPin}
      >
        {personalInfo.addresses.length === 0 ? (
          <ClientDetailEmptyState message={copy.addressEmpty} icon={MapPin} />
        ) : (
          <ul className="divide-y divide-border">
            {personalInfo.addresses.map((address) => (
              <li key={address.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-compact font-medium">{address.label}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {formatAddressLine(address) || copy.valueNotAvailable}
                    </p>
                  </div>
                  {address.isPrimary ? (
                    <StatusBadge variant="info">{copy.bankPrimary}</StatusBadge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PersonalInfoCard>

      <PersonalInfoCard
        title={copy.connectedAccountsTitle}
        description={copy.connectedAccountsDescription}
        icon={Building2}
      >
        <div className="divide-y divide-border">
          <OAuthProviderRow
            label={copy.google}
            connection={personalInfo.connectedAccounts.google}
            connectedLabel={copy.connected}
            notConnectedLabel={copy.notConnected}
          />
          <OAuthProviderRow
            label={copy.apple}
            connection={personalInfo.connectedAccounts.apple}
            connectedLabel={copy.connected}
            notConnectedLabel={copy.notConnected}
          />
        </div>
      </PersonalInfoCard>
    </div>
  );
}
