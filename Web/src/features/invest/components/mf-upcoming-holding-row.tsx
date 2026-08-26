import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import type { MfOrder } from "@/features/invest/api/invest-api";
import { truncateHoldingFundName } from "@/features/dashboard/overview/lib/overview-holdings-preview";
import {
  OVERVIEW_BRAND_CARD_STYLES,
  resolveOverviewBrandCardTone,
} from "@/features/dashboard/overview/lib/overview-brand-card-styles";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfUpcomingHoldingRowProps = {
  order: MfOrder;
  index?: number;
  className?: string;
};

export function MfUpcomingHoldingRow({ order, index = 0, className }: MfUpcomingHoldingRowProps) {
  const overview = copy.dashboard.overview;
  const styles = OVERVIEW_BRAND_CARD_STYLES[resolveOverviewBrandCardTone(index)];

  return (
    <article
      className={cn(
        "flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-[1.15rem] border border-dashed border-border/70 px-3 py-3 shadow-zynd-low",
        styles.card,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <MfFundAmcAvatar
          amcLogoUrl={order.amc_logo_url}
          amcName={order.amc_name ?? copy.mutualFunds.unknownAmc}
          size="sm"
          className={cn("rounded-full", styles.avatar)}
        />
        <div className="min-w-0">
          <p className={cn("truncate text-compact font-semibold", styles.title)}>
            {truncateHoldingFundName(order.product_name ?? copy.mutualFunds.unknownFund)}
          </p>
          <p className={cn("mt-0.5 truncate text-[11px]", styles.muted)}>
            {order.amc_name ?? copy.mutualFunds.unknownAmc}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-compact font-semibold tabular-nums tracking-tight", styles.title)}>
          {formatInr(order.amount_inr)}
        </p>
        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
          {overview.holdingsUpcomingLabel}
        </p>
      </div>
    </article>
  );
}
