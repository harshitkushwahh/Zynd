"use client";

import { Loader2, Plus } from "lucide-react";

import { DASHBOARD_NAV_CLUSTER_CLASS, DASHBOARD_NAV_ITEM_CLASS } from "@/components/dashboard/dashboard-layout";
import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfCartAmcAvatarStack } from "@/features/invest/components/mf-cart-amc-avatar-stack";
import { useMfCartNavbarMeta } from "@/features/invest/hooks/use-mf-cart-navbar-meta";
import { useMfFundNavbarMeta } from "@/features/invest/hooks/use-mf-fund-navbar-meta";
import { RiskProfileActiveCard } from "@/features/risk-profile/components/risk-profile-active-card";
import { useRiskProfileActiveCard } from "@/features/risk-profile/hooks/use-risk-profile-active-card";
import { ReferralActiveCard } from "@/features/referral/components/referral-active-card";
import { useReferralActiveCard } from "@/features/referral/hooks/use-referral-active-card";
import { copy } from "@/shared/config/copy";
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
  const showCartEmptyLabel = isCartPage && !showCartAmcs && !cartLoading;
  const cardTitle = showFundAmc ? fund!.amc_name : pageMeta.title;
  const activeCardLabel = showCartEmptyLabel
    ? copy.mutualFunds.cartNavbarEmptyLabel
    : !isCartPage
      ? cardTitle
      : null;
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
  const { isRiskProfileSection } = useRiskProfileActiveCard(pathname);
  const { isReferralSection } = useReferralActiveCard(pathname);

  if (isRiskProfileSection) {
    return (
      <div className={DASHBOARD_NAV_CLUSTER_CLASS}>
        <RiskProfileActiveCard />
      </div>
    );
  }

  if (isReferralSection) {
    return (
      <div className={DASHBOARD_NAV_CLUSTER_CLASS}>
        <ReferralActiveCard pathname={pathname} />
      </div>
    );
  }

  return (
    <div className={DASHBOARD_NAV_CLUSTER_CLASS}>
      <HoverCard>
        <HoverCardTrigger
          delay={200}
          closeDelay={120}
          render={
            <button
              type="button"
              className={cn(
                DASHBOARD_NAV_ITEM_CLASS,
                "w-auto justify-center text-center outline-none",
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
          ) : showCartEmptyLabel ? (
            <Plus className="size-4 shrink-0" strokeWidth={2.25} />
          ) : (
            <Icon className="size-4 shrink-0" strokeWidth={2.25} />
          )}
          {activeCardLabel ? (
            <span className="whitespace-nowrap text-[13px] font-medium leading-none">{activeCardLabel}</span>
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
            ) : showCartEmptyLabel ? (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                <Plus className="size-4" strokeWidth={2.25} />
              </div>
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
