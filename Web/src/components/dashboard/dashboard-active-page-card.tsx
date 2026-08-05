"use client";

import { Loader2, Plus } from "lucide-react";

import {
  DASHBOARD_ACTIVE_PAGE_LABEL_CLASS,
  DASHBOARD_NAV_ITEM_CLASS,
} from "@/components/dashboard/dashboard-layout";
import { NavbarActiveCardShell } from "@/components/dashboard/navbar-active-card-shell";
import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfCartAmcAvatarStack } from "@/features/invest/components/mf-cart-amc-avatar-stack";
import { useMfCartNavbarMeta } from "@/features/invest/hooks/use-mf-cart-navbar-meta";
import { useMfFundNavbarMeta } from "@/features/invest/hooks/use-mf-fund-navbar-meta";
import { RiskProfileActiveCard } from "@/features/risk-profile/components/risk-profile-active-card";
import { useRiskProfileActiveCard } from "@/features/risk-profile/hooks/use-risk-profile-active-card";
import { copy } from "@/shared/config/copy";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

const NAVBAR_CARD_CONTENT_CLASS =
  "inline-flex h-10 items-center gap-1.5 transition-opacity duration-200 ease-out motion-reduce:transition-none";

function NavbarIconSlot({
  loading,
  children,
}: {
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {loading ? (
        <Loader2 className="size-4 animate-spin opacity-70" aria-hidden="true" />
      ) : (
        children
      )}
    </span>
  );
}

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

  const measureKey = [
    pathname,
    isRiskProfileSection ? "risk" : "default",
    isCartPage
      ? showCartAmcs
        ? `amcs-${visibleItems.length}-${overflowCount}`
        : "empty"
      : activeCardLabel ?? "",
    showFundAmc ? fund!.amc_name : "",
  ].join("|");

  const triggerClassName = cn(
    DASHBOARD_NAV_ITEM_CLASS,
    "w-full max-w-[14.5rem] justify-center text-center outline-none",
    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  return (
    <NavbarActiveCardShell measureKey={measureKey}>
      {isRiskProfileSection ? (
        <RiskProfileActiveCard triggerClassName={triggerClassName} />
      ) : (
        <HoverCard>
          <HoverCardTrigger
            delay={200}
            closeDelay={120}
            render={
              <button
                type="button"
                className={triggerClassName}
                aria-label={`${ariaLabel} page info`}
              />
            }
          >
            {isCartPage ? (
              <span
                className={cn(
                  NAVBAR_CARD_CONTENT_CLASS,
                  "min-w-[5.5rem] justify-center",
                  !showCartAmcs && "px-0",
                )}
              >
                {showCartAmcs ? (
                  <MfCartAmcAvatarStack items={visibleItems} overflowCount={overflowCount} />
                ) : (
                  <>
                    <Plus className="size-4 shrink-0" strokeWidth={2.25} />
                    <span
                      className={cn(
                        DASHBOARD_ACTIVE_PAGE_LABEL_CLASS,
                        cartLoading && "text-transparent",
                      )}
                      aria-hidden={cartLoading}
                    >
                      {copy.mutualFunds.cartNavbarEmptyLabel}
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span className={cn(NAVBAR_CARD_CONTENT_CLASS, "w-full justify-center")}>
                <NavbarIconSlot loading={isLoading && !showFundAmc}>
                  {showFundAmc ? (
                    <MfFundAmcAvatar
                      amcLogoUrl={fund!.amc_logo_url}
                      amcName={fund!.amc_name}
                      size="sm"
                      className="size-4 shrink-0 rounded-full p-0"
                    />
                  ) : (
                    <Icon className="size-4 shrink-0" strokeWidth={2.25} />
                  )}
                </NavbarIconSlot>
                {activeCardLabel ? (
                  <span
                    className={cn(
                      DASHBOARD_ACTIVE_PAGE_LABEL_CLASS,
                      isLoading && !showFundAmc && "text-transparent",
                    )}
                    aria-hidden={isLoading && !showFundAmc}
                  >
                    {isLoading && !showFundAmc ? pageMeta.title : activeCardLabel}
                  </span>
                ) : null}
              </span>
            )}
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
      )}
    </NavbarActiveCardShell>
  );
}
