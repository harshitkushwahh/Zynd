"use client";

import { FileCheck2, Hash, IdCard, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";

import { DistributorCodeCopyBadge } from "@/components/dashboard/distributor-code-copy-badge";
import { Card, CardContent } from "@/components/ui/card";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  formatDistributorProfileAddress,
  getDistributorProfile,
  type DistributorProfileDocument,
} from "@/lib/distributor-profile";
import { formatDistributorDate } from "@/lib/format";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

function ProfileSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden border-border bg-card shadow-sm",
        className,
      )}
    >
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

function DetailRow({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  mono?: boolean;
}) {
  const empty = !value.trim();

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-compact">
      <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 text-right font-medium text-foreground",
          mono && !empty && "font-mono text-caption",
          empty && "text-muted-foreground",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function DocumentCard({ document }: { document: DistributorProfileDocument }) {
  const DocIcon = document.type === "pan" ? IdCard : FileCheck2;

  return (
    <li className="min-w-0">
      <Card className="h-full overflow-hidden bg-muted/10 shadow-sm ring-border">
        <div className="px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-background text-muted-foreground ring-1 ring-border">
                <DocIcon className="size-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-compact font-medium text-foreground">{document.label}</p>
                {document.uploaded && document.fileName ? (
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {document.fileName}
                  </p>
                ) : (
                  <p className="mt-0.5 text-caption text-muted-foreground">Not uploaded</p>
                )}
              </div>
            </div>
            <StatusBadge variant={document.uploaded ? "success" : "warning"}>
              {document.uploaded ? "Uploaded" : "Missing"}
            </StatusBadge>
          </div>
          {document.uploaded ? (
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-caption">
              {document.identifierMasked ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Number</dt>
                  <dd className="font-mono font-medium text-foreground">
                    {document.identifierMasked}
                  </dd>
                </div>
              ) : null}
              {document.uploadedAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Uploaded on</dt>
                  <dd className="font-medium text-foreground">
                    {formatDistributorDate(document.uploadedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

export function DistributorProfileSettingsPanel() {
  const { user, displayName } = useDistributorAuth();
  const profile = getDistributorProfile(user?.id);
  const addressText = formatDistributorProfileAddress(profile.address);
  const hasAddress = Boolean(addressText.trim());
  const distributorCode = profile.distributorCode.trim();

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <Card
        className={cn(
          "distributor-client-personal-info-account distributor-metric-card--tile distributor-metric-card--tile-accent overflow-hidden rounded-[var(--radius-5xl)] ring-0",
        )}
      >
        <CardContent className="distributor-client-personal-info-account__body h-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <DistributorProfileAvatar
                name={displayName}
                imageSrc={user?.avatarUrl}
                className={cn("distributor-settings-avatar shrink-0")}
              />
              <div className="min-w-0">
                <p className="distributor-client-personal-info-account__eyebrow">{ZYND_MITRA_COPY.mitraAccount}</p>
                <h3 className="distributor-client-personal-info-account__title">{displayName}</h3>
              </div>
            </div>
            {distributorCode ? (
              <DistributorCodeCopyBadge
                placement="inline"
                distributorCode={distributorCode}
                className="distributor-code-copy-badge--compact shrink-0 self-start sm:self-center"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSectionCard
          title={ZYND_MITRA_COPY.mitraDetails}
          description="Sign-in and registration identifiers on file"
          icon={Hash}
        >
          <dl className="divide-y divide-border">
            <DetailRow label={ZYND_MITRA_COPY.mitraCode} value={profile.distributorCode} icon={Hash} mono />
            <DetailRow label="Email" value={user?.email ?? ""} icon={Mail} />
            <DetailRow label="Mobile number" value={profile.mobile} icon={Phone} />
          </dl>
        </ProfileSectionCard>

        <ProfileSectionCard
          title="Address"
          description="Registered business or correspondence address"
          icon={MapPin}
        >
          {hasAddress ? (
            <p className="whitespace-pre-line px-4 py-4 text-compact leading-relaxed text-foreground">
              {addressText}
            </p>
          ) : (
            <p className="px-4 py-4 text-compact text-muted-foreground">No address on file.</p>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          title="Documents uploaded"
          description={ZYND_MITRA_COPY.mitraVerification}
          icon={IdCard}
          className="lg:col-span-2"
        >
          <ul className="grid gap-3 p-4 sm:grid-cols-2">
            {profile.documents.map((document) => (
              <DocumentCard key={document.type} document={document} />
            ))}
          </ul>
        </ProfileSectionCard>
      </div>
    </div>
  );
}
