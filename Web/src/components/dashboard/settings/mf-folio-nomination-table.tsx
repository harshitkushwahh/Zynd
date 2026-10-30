"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderOpen, UserCheck, UserRoundX } from "lucide-react";

import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { KycInfoCallout } from "@/features/kyc/components/kyc-info-callout";
import { fetchMfFolioNominations, type MfFolioNominationItem } from "@/features/kyc/lib/kyc-api";
import { StatusBadge } from "@/components/ui/status-badge";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFolioNominationTableProps = {
  enabled?: boolean;
  className?: string;
};

function AmcNominationMissingPill({ className }: { className?: string }) {
  const settingsCopy = copy.settings;
  return (
    <span
      role="status"
      aria-label={settingsCopy.nomineesRegisteredFoliosNomineeMissing}
      className={cn(
        "inline-flex max-w-[14rem] items-center gap-2 rounded-[var(--radius-full)] border border-amber-500/25 bg-amber-500/[0.06] py-1 pl-1 pr-3 shadow-zynd-low ring-1 ring-inset ring-amber-500/10",
        className,
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-400"
        aria-hidden
      >
        <UserRoundX className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[11px] font-semibold text-foreground">
          {settingsCopy.nomineesRegisteredFoliosNomineeMissingShort}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {settingsCopy.nomineesRegisteredFoliosNomineeMissingHint}
        </span>
      </span>
    </span>
  );
}

function AmcNominationPresentPill({ name }: { name: string }) {
  return (
    <span
      role="status"
      className="inline-flex max-w-[14rem] items-center gap-2 rounded-[var(--radius-full)] border border-success/25 bg-success/[0.06] py-1 pl-1 pr-3 ring-1 ring-inset ring-success/10"
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/12 text-success ring-1 ring-inset ring-success/25"
        aria-hidden
      >
        <UserCheck className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[10px] font-medium text-muted-foreground">
          {copy.settings.nomineesRegisteredFoliosNomineePresent}
        </span>
        <span className="block truncate text-[11px] font-semibold text-foreground">{name}</span>
      </span>
    </span>
  );
}

function NominationBadge({ folio, align = "start" }: { folio: MfFolioNominationItem; align?: "start" | "end" }) {
  const hasNominee =
    folio.nominee_count > 0 || Boolean(folio.primary_nominee_name?.trim());
  const label =
    folio.primary_nominee_name?.trim() ||
    folio.nominee_status ||
    copy.settings.nomineesRegisteredFoliosNomineeMissing;
  const alignClass = align === "end" ? "items-end" : "items-start";

  if (hasNominee && folio.primary_nominee_name?.trim()) {
    return (
      <div className={cn("flex min-w-0", alignClass)}>
        <AmcNominationPresentPill name={folio.primary_nominee_name.trim()} />
      </div>
    );
  }

  if (hasNominee) {
    return (
      <div className={cn("flex", alignClass)}>
        <StatusBadge variant="info" icon={UserCheck} className="h-auto max-w-[14rem] py-1 pl-1.5 pr-2.5 text-[10px]">
          <span className="truncate">{label}</span>
        </StatusBadge>
      </div>
    );
  }

  return (
    <div className={cn("flex", alignClass)}>
      <AmcNominationMissingPill />
    </div>
  );
}

function RegisteredFolioTableRow({ folio }: { folio: MfFolioNominationItem }) {
  return (
    <tr>
      <td className="px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <MfFundAmcAvatar
            amcName={folio.amc_name}
            amcSlug={folio.amc_slug ?? undefined}
            className="size-8 shrink-0 text-[10px]"
          />
          <span className="truncate text-caption font-medium text-foreground">{folio.amc_name}</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex rounded-[var(--radius-control)] bg-muted/50 px-2.5 py-1 font-mono text-[11px] tabular-nums text-foreground ring-1 ring-inset ring-border/50">
          {folio.folio_number}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <NominationBadge folio={folio} />
      </td>
    </tr>
  );
}

function RegisteredFolioMobileCard({ folio }: { folio: MfFolioNominationItem }) {
  return (
    <div className="px-4 py-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <MfFundAmcAvatar
          amcName={folio.amc_name}
          amcSlug={folio.amc_slug ?? undefined}
          className="size-9 shrink-0 text-[10px]"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-caption font-semibold text-foreground">{folio.amc_name}</p>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{folio.folio_number}</p>
          <div className="pt-0.5">
            <NominationBadge folio={folio} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MfFolioNominationTable({ enabled = true, className }: MfFolioNominationTableProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["kyc", "mf-folio-nominations"],
    queryFn: fetchMfFolioNominations,
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) {
    return null;
  }

  const folioInfoCallout = (
    <KycInfoCallout description={copy.settings.nomineesRegisteredFoliosInfo} className="shadow-none" />
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-card shadow-zynd-low">
          <div className="border-b border-border/60 px-4 py-3.5">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-full max-w-sm animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-20 animate-pulse bg-muted/20" />
        </div>
        {folioInfoCallout}
      </div>
    );
  }

  if (isError || !data?.available) {
    return null;
  }

  const folios = data.folios ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-card shadow-zynd-low">
        <header className="flex items-start gap-3 border-b border-border/60 bg-muted/15 px-4 py-3.5 sm:px-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <FolderOpen className="size-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-compact font-semibold text-foreground">
              {copy.settings.nomineesRegisteredFoliosTitle}
            </h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {copy.settings.nomineesRegisteredFoliosDescription}
            </p>
          </div>
        </header>

        {folios.length === 0 ? (
          <p className="px-4 py-6 text-center text-caption text-muted-foreground sm:px-5">
            {copy.settings.nomineesRegisteredFoliosEmpty}
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-caption">
                <thead className="border-b border-border/60 bg-muted/20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{copy.settings.nomineesRegisteredFoliosAmcColumn}</th>
                    <th className="px-4 py-2.5 font-semibold">{copy.settings.nomineesRegisteredFoliosFolioColumn}</th>
                    <th className="px-4 py-2.5 font-semibold">{copy.settings.nomineesRegisteredFoliosNomineeColumn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {folios.map((folio) => (
                    <RegisteredFolioTableRow
                      key={`${folio.amc_code ?? "amc"}-${folio.folio_number}`}
                      folio={folio}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border/50 md:hidden">
              {folios.map((folio) => (
                <RegisteredFolioMobileCard
                  key={`${folio.amc_code ?? "amc"}-${folio.folio_number}-m`}
                  folio={folio}
                />
              ))}
            </div>
          </>
        )}
      </section>
      {folioInfoCallout}
    </div>
  );
}
