"use client";

import type { MfCartItem } from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { cn } from "@/lib/utils";

type MfCartAmcAvatarStackProps = {
  items: MfCartItem[];
  overflowCount?: number;
  className?: string;
};

export function MfCartAmcAvatarStack({
  items,
  overflowCount = 0,
  className,
}: MfCartAmcAvatarStackProps) {
  if (items.length === 0 && overflowCount === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center", className)}>
      {items.map((item, index) => {
        const amcName = item.amc_name ?? item.product_name ?? "Fund";
        return (
          <span
            key={`${item.product_id}-${item.investment_type}`}
            className={cn("relative shrink-0", index > 0 && "-ml-2")}
            style={{ zIndex: items.length - index }}
          >
            <MfFundAmcAvatar
              amcLogoUrl={item.amc_logo_url}
              amcName={amcName}
              size="sm"
              className="size-6 p-0.5 ring-2 ring-card"
            />
          </span>
        );
      })}
      {overflowCount > 0 ? (
        <span
          className="relative -ml-2 flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground ring-2 ring-card"
          style={{ zIndex: 0 }}
        >
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
}
