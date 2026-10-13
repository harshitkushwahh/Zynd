"use client";

import { useQuery } from "@tanstack/react-query";

import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { fetchMfFolioNominations } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFolioNominationTableProps = {
  enabled?: boolean;
  className?: string;
};

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

  if (isLoading) {
    return (
      <div className={cn("space-y-2 rounded-[var(--radius-card)] border border-border/70 bg-muted/10 p-4", className)}>
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted/80" />
        <div className="mt-3 h-16 animate-pulse rounded bg-muted/60" />
      </div>
    );
  }

  if (isError || !data?.available) {
    return null;
  }

  const folios = data.folios ?? [];

  return (
    <div className={cn("space-y-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/10 p-4", className)}>
      <div className="space-y-1">
        <p className="text-compact font-semibold text-foreground">{copy.settings.nomineesRegisteredFoliosTitle}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {copy.settings.nomineesRegisteredFoliosDescription}
        </p>
      </div>

      {folios.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.settings.nomineesRegisteredFoliosEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border/60">
          <table className="w-full min-w-[28rem] text-left text-caption">
            <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">{copy.settings.nomineesRegisteredFoliosAmcColumn}</th>
                <th className="px-3 py-2.5">{copy.settings.nomineesRegisteredFoliosFolioColumn}</th>
                <th className="px-3 py-2.5">{copy.settings.nomineesRegisteredFoliosNomineeColumn}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card/50">
              {folios.map((folio) => {
                const nomineeLabel =
                  folio.primary_nominee_name?.trim() ||
                  folio.nominee_status ||
                  copy.dashboard.portfolio.holdingNomineeEmpty;
                return (
                  <tr key={`${folio.amc_code ?? "amc"}-${folio.folio_number}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <MfFundAmcAvatar
                          amcName={folio.amc_name}
                          amcSlug={folio.amc_slug ?? undefined}
                          className="size-7 shrink-0 text-[10px]"
                        />
                        <span className="truncate font-medium text-foreground">{folio.amc_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{folio.folio_number}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{nomineeLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
