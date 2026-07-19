"use client";

import { Loader2 } from "lucide-react";

import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfCartAmcAvatarStack } from "@/features/invest/components/mf-cart-amc-avatar-stack";
import { useMfCartNavbarMeta } from "@/features/invest/hooks/use-mf-cart-navbar-meta";
import { useMfFundNavbarMeta } from "@/features/invest/hooks/use-mf-fund-navbar-meta";
import { copy } from "@/shared/config/copy";
import { uiClasses } from "@/shared/config/ui-classes";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export function DashboardActivePageCard() {
  const { pathname, pageMeta } = useDashboardRoute();
  const { fund, loading: fundLoading, isFundPage } = useMfFundNavbarMeta(pathname);
  const {
    isCartPage,
    visibleItems,
    overflowCount,
    loading: cartLoading,
    totalCount: cartCount,
  } = useMfCartNavbarMeta(pathname);
  const Icon = pageMeta.icon;

  const showFundAmc = isFundPage && Boolean(fund?.amc_name);
  const showCartAmcs = isCartPage && cartCount > 0;
  const cardTitle = showFundAmc ? fund!.amc_name : pageMeta.title;
  const ariaLabel = isCartPage ? copy.mutualFunds.cartTitle : cardTitle;
  const hoverTitle = showFundAmc
    ? fund!.name
    : showCartAmcs
      ? copy.mutualFunds.cartTitle
      : pageMeta.title;
  const hoverDescription = showFundAmc
    ? fund!.amc_name
    : showCartAmcs
      ? copy.mutualFunds.cartItemCount.replace("{count}", String(cartCount))
      : pageMeta.description;
  const isLoading = (isFundPage && fundLoading) || (isCartPage && cartLoading);

  return (
    <div className={cn("flex items-center justify-center", uiClasses.navSurface)}>
      <HoverCard>
        <HoverCardTrigger
          delay={200}
          closeDelay={120}
          render={
            <button
              type="button"
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-full)] text-center outline-none",
                isCartPage ? "w-auto px-3" : "w-[11rem] px-2.5",
                "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
              aria-label={`${ariaLabel} page info`}
            />
          }
        >
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin opacity-70" aria-hidden="true" />
          ) : showCartAmcs ? (
            <MfCartAmcAvatarStack items={visibleItems} overflowCount={overflowCount} />
          ) : showFundAmc ? (
            <MfFundAmcAvatar
              amcLogoUrl={fund!.amc_logo_url}
              amcName={fund!.amc_name}
              size="sm"
              className="size-6 shrink-0 p-0.5"
            />
          ) : (
            <Icon className="size-4 shrink-0" strokeWidth={2.25} />
          )}
          {!isCartPage ? (
            <span className="truncate text-[13px] font-medium leading-none">{cardTitle}</span>
          ) : null}
        </HoverCardTrigger>

        <HoverCardContent side="bottom" align="end" className="w-72">
          <div className="flex items-start gap-3">
            {showCartAmcs ? (
              <MfCartAmcAvatarStack
                items={visibleItems}
                overflowCount={overflowCount}
                className="pt-0.5"
              />
            ) : showFundAmc ? (
              <MfFundAmcAvatar
                amcLogoUrl={fund!.amc_logo_url}
                amcName={fund!.amc_name}
                className="size-9 shrink-0 p-1"
              />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                <Icon className="size-4" strokeWidth={2.25} />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 text-compact font-semibold text-foreground">{hoverTitle}</p>
              <p className="text-caption leading-relaxed text-muted-foreground">{hoverDescription}</p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
