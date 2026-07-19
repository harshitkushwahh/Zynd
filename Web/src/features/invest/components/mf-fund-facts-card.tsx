"use client";

import { Building2 } from "lucide-react";

import { copy } from "@/shared/config/copy";
import type { InvestFundDetail } from "@/features/invest/api/invest-api";
import { resolveInvestAssetUrl } from "@/features/invest/lib/mf-format";

type FundFactsData = Pick<InvestFundDetail, "fund_house" | "content" | "amc_logo_url" | "amc_name">;

function FundFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-3 sm:px-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function AmcFactRow({
  value,
  logoUrl,
  amcName,
}: {
  value: string;
  logoUrl: string | null;
  amcName: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={amcName}
          className="size-9 shrink-0 rounded-full border border-border/70 bg-background object-contain p-1.5"
        />
      ) : (
        <div className="sip-icon-badge flex size-9 shrink-0 items-center justify-center rounded-full">
          <Building2 className="size-4" strokeWidth={2.25} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <span className="text-muted-foreground">AMC</span>
        <span className="text-right font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

type MfFundFactsCardProps = {
  fund: FundFactsData;
};

export function MfFundFactsCard({ fund }: MfFundFactsCardProps) {
  const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);
  const hasInlineFacts =
    fund.fund_house?.name ||
    fund.fund_house?.rta?.name ||
    fund.content?.benchmark_name ||
    fund.content?.fund_manager_name;

  if (!hasInlineFacts && !fund.fund_house?.address && !fund.content?.amc_description && !fund.content?.amc_website_url) {
    return null;
  }

  return (
    <div className="space-y-3 text-compact">
      {hasInlineFacts ? (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-border/70 bg-muted/10 divide-y divide-border/60">
          {fund.fund_house?.name ? (
            <AmcFactRow value={fund.fund_house.name} logoUrl={logoUrl} amcName={fund.amc_name} />
          ) : null}
          {fund.fund_house?.rta?.name ? (
            <FundFactRow label="Registrar" value={fund.fund_house.rta.name} />
          ) : null}
          {fund.content?.benchmark_name ? (
            <FundFactRow label={copy.mutualFunds.benchmarkLabel} value={fund.content.benchmark_name} />
          ) : null}
          {fund.content?.fund_manager_name ? (
            <FundFactRow
              label={copy.mutualFunds.fundManagerLabel}
              value={fund.content.fund_manager_name}
            />
          ) : null}
        </div>
      ) : null}

      {fund.fund_house?.address ? (
        <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 p-3.5 sm:p-4">
          <p className="text-caption text-muted-foreground">Address</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{fund.fund_house.address}</p>
        </div>
      ) : null}

      {fund.content?.amc_description ? (
        <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/10 p-3.5 sm:p-4">
          <p className="text-caption text-muted-foreground">{copy.mutualFunds.amcDescriptionLabel}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{fund.content.amc_description}</p>
        </div>
      ) : null}

      {fund.content?.amc_website_url ? (
        <div className="px-1">
          <a
            href={fund.content.amc_website_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {copy.mutualFunds.amcWebsiteLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function shouldShowFundFacts(fund: InvestFundDetail) {
  return Boolean(
    fund.fund_house?.name ||
      fund.fund_house?.rta?.name ||
      fund.fund_house?.address ||
      fund.content?.benchmark_name ||
      fund.content?.fund_manager_name ||
      fund.content?.amc_description ||
      fund.content?.amc_website_url,
  );
}
