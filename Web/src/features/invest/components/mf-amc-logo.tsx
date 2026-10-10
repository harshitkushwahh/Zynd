import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";
import { cn } from "@/lib/utils";

export function AmcLogo({ fund, className }: { fund: InvestFundSummary; className?: string }) {
  const logoUrl = resolveAmcLogoUrl(fund.amc_logo_url, fund.amc_slug);
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "size-11 rounded-[var(--radius-control)] bg-background object-contain p-1.5",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-muted/40 text-caption font-semibold text-muted-foreground",
        className,
      )}
    >
      {fund.amc_name.slice(0, 2).toUpperCase()}
    </div>
  );
}
