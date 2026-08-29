"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Info, Check, Loader2, Plus, ShoppingCart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import "@/styles/zynd-recommend-funds-button.css";
import { RecommendFundsAllocationPanel } from "@/components/dashboard/recommend-funds-allocation-panel";
import { BorderGlow } from "@/components/ui/border-glow";
import { Button } from "@/components/ui/button";
import { Grainient } from "@/components/ui/grainient";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { useMfScreenerCartDrop } from "@/features/invest/hooks/use-mf-screener-cart-drop";
import { getLumpsumCartProductIds, useMfCartQuery } from "@/features/invest/hooks/use-mf-cart-query";
import { filterNewLumpsumCartFunds } from "@/features/invest/lib/mf-cart-limits";
import { useFundsForYouQuery } from "@/features/recommendations/hooks/use-funds-for-you-query";
import { mapFundsForYouAllocation } from "@/features/recommendations/lib/map-funds-for-you-allocation";
import { mapFundsForYouCartFund } from "@/features/recommendations/lib/map-funds-for-you-cart-fund";
import type {
  FundsForYouBlockReason,
  FundsForYouFund,
  FundsForYouPortfolioStory,
} from "@/features/recommendations/types/funds-for-you";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HOVER_CLOSE_DELAY_MS = 220;
const POPOVER_OPEN_DURATION_S = 0.36;
const POPOVER_CLOSE_DURATION_S = 0.26;
const POPOVER_EASE = [0.16, 1, 0.3, 1] as const;
const LOADING_SKELETON_ROWS = 5;

const RECOMMEND_FUNDS_BORDER_GLOW_PROPS = {
  borderRadius: 30,
  backgroundColor: "#3B0764",
  glowColor: "280 100 88",
  colors: ["#F3E8FF", "#E9D5FF", "#D8B4FE", "#C4B5FD"],
  glowRadius: 52,
  glowIntensity: 1.55,
  edgeSensitivity: 10,
  coneSpread: 34,
  fillOpacity: 0.72,
  animated: false,
} as const;

const RECOMMEND_FUNDS_GRAINIENT_PROPS = {
  color1: "#6D28D9",
  color2: "#5B21B6",
  color3: "#3B0764",
  timeSpeed: 0.18,
  colorBalance: 0.28,
  warpStrength: 0.75,
  warpFrequency: 4.0,
  warpSpeed: 1.4,
  warpAmplitude: 60.0,
  blendAngle: 18.0,
  blendSoftness: 0.04,
  rotationAmount: 360.0,
  noiseScale: 1.8,
  grainAmount: 0.06,
  grainScale: 2.2,
  grainAnimated: false,
  contrast: 1.2,
  gamma: 1.05,
  saturation: 1.08,
  centerX: 0.0,
  centerY: 0.0,
  zoom: 0.52,
} as const;

type RecommendFundsHoverCardProps = {
  trigger: ReactNode;
};

type BlockStateCopy = {
  title: string;
  description: string;
  actionLabel?: string;
};

function resolveBlockStateCopy(blockReason: FundsForYouBlockReason): BlockStateCopy {
  const navbarCopy = copy.navbar.recommendFunds;

  switch (blockReason) {
    case "kyc_required":
      return {
        title: navbarCopy.kycRequiredTitle,
        description: navbarCopy.kycRequiredDescription,
        actionLabel: navbarCopy.kycRequiredAction,
      };
    case "risk_profile_required":
      return {
        title: navbarCopy.riskRequiredTitle,
        description: navbarCopy.riskRequiredDescription,
        actionLabel: navbarCopy.riskRequiredAction,
      };
    case "no_baskets":
      return {
        title: navbarCopy.noBasketsTitle,
        description: navbarCopy.noBasketsDescription,
      };
    case "insufficient_funds":
      return {
        title: navbarCopy.insufficientFundsTitle,
        description: navbarCopy.insufficientFundsDescription,
      };
    default:
      return {
        title: navbarCopy.noBasketsTitle,
        description: navbarCopy.noBasketsDescription,
      };
  }
}

function RecommendFundsLoadingBody() {
  const navbarCopy = copy.navbar.recommendFunds;

  return (
    <div
      className="recommend-funds-popover-body recommend-funds-popover-body-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="recommend-funds-popover-funds-column">
        <div className="space-y-0.5 px-1 pb-1 pt-2">
          {Array.from({ length: LOADING_SKELETON_ROWS }, (_, index) => (
            <div
              key={`recommend-funds-skeleton-row-${index}`}
              className="recommend-funds-popover-skeleton-row"
              aria-hidden
            >
              <div className="recommend-funds-popover-skeleton-logo" />
              <div className="recommend-funds-popover-skeleton-text">
                <div className="recommend-funds-popover-skeleton-line recommend-funds-popover-skeleton-line-wide" />
                <div className="recommend-funds-popover-skeleton-line recommend-funds-popover-skeleton-line-narrow" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="recommend-funds-popover-allocation-panel">
        <p className="recommend-funds-popover-allocation-title">{navbarCopy.popoverTitle}</p>
        <p className="sr-only">{navbarCopy.loadingLabel}</p>
        <div className="recommend-funds-popover-skeleton-chart" aria-hidden />
      </div>

      <div className="recommend-funds-popover-body-spacer" aria-hidden />
    </div>
  );
}

function RecommendFundsBlockBody({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: BlockStateCopy & {
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="recommend-funds-popover-state">
      <p className="recommend-funds-popover-state-title">{title}</p>
      <p className="recommend-funds-popover-state-description">{description}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          className="recommend-funds-popover-state-action"
          onClick={onAction}
          onMouseDown={(event) => event.preventDefault()}
        >
          {actionLabel}
        </Button>
      ) : null}
      {actionLabel && actionHref ? (
        <Button
          type="button"
          nativeButton={false}
          className="recommend-funds-popover-state-action"
          render={<Link href={actionHref} />}
          onMouseDown={(event) => event.preventDefault()}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function resolveFundInCart(
  fund: FundsForYouFund,
  inCartProductIds: ReadonlySet<string>,
  cartLoaded: boolean,
) {
  if (cartLoaded) {
    return inCartProductIds.has(fund.product_id);
  }

  return fund.in_cart || inCartProductIds.has(fund.product_id);
}

function computeRecommendFundsPortfolioStatus(
  funds: FundsForYouFund[],
  inCartProductIds: ReadonlySet<string>,
  cartLoaded: boolean,
) {
  let inPortfolio = 0;
  let inCartOnly = 0;
  let notAdded = 0;

  for (const fund of funds) {
    const inCart = resolveFundInCart(fund, inCartProductIds, cartLoaded);
    if (fund.in_portfolio) {
      inPortfolio += 1;
    } else if (inCart) {
      inCartOnly += 1;
    } else {
      notAdded += 1;
    }
  }

  return {
    inPortfolio,
    inCartOnly,
    notAdded,
    total: funds.length,
  };
}

function RecommendFundsPortfolioStatusRow({
  kind,
  count,
  label,
}: {
  kind: "portfolio" | "cart" | "pending";
  count: number;
  label: string;
}) {
  return (
    <div className="recommend-funds-popover-portfolio-status-row">
      <span
        className={cn(
          "recommend-funds-popover-portfolio-status-dot",
          kind === "portfolio" && "recommend-funds-popover-portfolio-status-dot-portfolio",
          kind === "cart" && "recommend-funds-popover-portfolio-status-dot-cart",
          kind === "pending" && "recommend-funds-popover-portfolio-status-dot-pending",
        )}
        aria-hidden
      />
      <span className="recommend-funds-popover-portfolio-status-count">{count}</span>
      <span className="recommend-funds-popover-portfolio-status-label">{label}</span>
    </div>
  );
}

function RecommendFundsPortfolioStory({
  story,
  funds,
  inCartProductIds,
  cartLoaded,
}: {
  story: FundsForYouPortfolioStory | null;
  funds: FundsForYouFund[];
  inCartProductIds: ReadonlySet<string>;
  cartLoaded: boolean;
}) {
  const navbarCopy = copy.navbar.recommendFunds;
  const whyThisMix = story?.why_this_mix?.trim();
  const status = useMemo(
    () => computeRecommendFundsPortfolioStatus(funds, inCartProductIds, cartLoaded),
    [cartLoaded, funds, inCartProductIds],
  );

  if (!status.total && !whyThisMix) return null;

  const progressPct =
    status.total > 0 ? Math.round((status.inPortfolio / status.total) * 100) : 0;

  return (
    <div className="recommend-funds-popover-portfolio-story">
      <div className="recommend-funds-popover-portfolio-story-content">
        {status.total > 0 ? (
          <div className="recommend-funds-popover-portfolio-status">
            <p className="recommend-funds-popover-portfolio-status-title">
              {navbarCopy.portfolioStatusTitle}
            </p>
            <div className="recommend-funds-popover-portfolio-status-progress" aria-hidden>
              <div
                className="recommend-funds-popover-portfolio-status-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="recommend-funds-popover-portfolio-status-list">
              <RecommendFundsPortfolioStatusRow
                kind="portfolio"
                count={status.inPortfolio}
                label={navbarCopy.portfolioStatusInPortfolio}
              />
              <RecommendFundsPortfolioStatusRow
                kind="cart"
                count={status.inCartOnly}
                label={navbarCopy.portfolioStatusInCart}
              />
              <RecommendFundsPortfolioStatusRow
                kind="pending"
                count={status.notAdded}
                label={navbarCopy.portfolioStatusNotAdded}
              />
            </div>
          </div>
        ) : null}
        {whyThisMix ? (
          <div className="recommend-funds-popover-portfolio-story-why">
            <p className="recommend-funds-popover-portfolio-story-why-label">
              {navbarCopy.portfolioStoryWhyLabel}
            </p>
            <p className="recommend-funds-popover-portfolio-story-why-copy">{whyThisMix}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function resolveFundActionState(inCart: boolean, inPortfolio: boolean) {
  if (inPortfolio) return "portfolio" as const;
  if (inCart) return "cart" as const;
  return "default" as const;
}

function RecommendFundsFundRow({
  fund,
  cartEnabled,
  adding,
  inCart,
  inPortfolio,
  onAdd,
}: {
  fund: FundsForYouFund;
  cartEnabled: boolean;
  adding: boolean;
  inCart: boolean;
  inPortfolio: boolean;
  onAdd: (fund: FundsForYouFund) => void;
}) {
  const navbarCopy = copy.navbar.recommendFunds;
  const actionState = resolveFundActionState(inCart, inPortfolio);
  const isAdded = actionState !== "default";

  return (
    <div className="recommend-funds-popover-fund-row">
      <MfFundAmcAvatar
        amcLogoUrl={fund.amc_logo_url}
        amcSlug={fund.amc_slug}
        amcName={fund.amc_name}
        size="sm"
        className="border-white/20 bg-white/15 text-white"
      />
      <div className="min-w-0 flex-1">
        <p className="recommend-funds-popover-fund-name">{fund.scheme_name}</p>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                "recommend-funds-popover-fund-action",
                actionState === "default" && "recommend-funds-popover-fund-action-default",
                actionState === "cart" && "recommend-funds-popover-fund-action-cart",
                actionState === "portfolio" && "recommend-funds-popover-fund-action-portfolio",
              )}
              aria-label={
                actionState === "portfolio"
                  ? `${fund.scheme_name} ${navbarCopy.fundInPortfolio}`
                  : actionState === "cart"
                    ? `${fund.scheme_name} ${navbarCopy.fundInCartNotPortfolio}`
                    : `Add ${fund.scheme_name} to cart`
              }
              disabled={!cartEnabled || adding || isAdded}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                if (!cartEnabled || adding || isAdded) return;
                void onAdd(fund);
              }}
            />
          }
        >
          {adding ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : actionState === "portfolio" ? (
            <Check className="size-4" strokeWidth={2.75} aria-hidden />
          ) : (
            <Plus className="size-4" strokeWidth={2.25} aria-hidden />
          )}
        </TooltipTrigger>
        {!cartEnabled ? (
          <TooltipContent side="top" align="end" className="max-w-[13rem] text-left leading-snug">
            {navbarCopy.cartDisabledHint}
          </TooltipContent>
        ) : actionState === "portfolio" ? (
          <TooltipContent side="top" align="end" className="max-w-[13rem] text-left leading-snug">
            {navbarCopy.fundInPortfolio}
          </TooltipContent>
        ) : actionState === "cart" ? (
          <TooltipContent side="top" align="end" className="max-w-[13rem] text-left leading-snug">
            {navbarCopy.fundInCartNotPortfolio}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </div>
  );
}

function RecommendFundsSuccessBody({
  funds,
  allocation,
  portfolioStory,
  cartEnabled,
  adding,
  inCartProductIds,
  cartLoaded,
  onAddFund,
}: {
  funds: FundsForYouFund[];
  allocation: ReturnType<typeof mapFundsForYouAllocation>;
  portfolioStory: FundsForYouPortfolioStory | null;
  cartEnabled: boolean;
  adding: boolean;
  inCartProductIds: ReadonlySet<string>;
  cartLoaded: boolean;
  onAddFund: (fund: FundsForYouFund) => void;
}) {
  return (
    <div className="recommend-funds-popover-success">
      <div className="recommend-funds-popover-body">
        <div className="recommend-funds-popover-funds-column">
          <div className="space-y-0.5 px-1 pb-1 pt-2">
            {funds.map((fund) => {
              const inCart = resolveFundInCart(fund, inCartProductIds, cartLoaded);
              return (
                <RecommendFundsFundRow
                  key={fund.product_id}
                  fund={fund}
                  cartEnabled={cartEnabled}
                  adding={adding}
                  inCart={inCart}
                  inPortfolio={fund.in_portfolio}
                  onAdd={onAddFund}
                />
              );
            })}
          </div>
        </div>

        <RecommendFundsAllocationPanel slices={allocation} />

        {funds.length > 0 || portfolioStory ? (
          <RecommendFundsPortfolioStory
            story={portfolioStory}
            funds={funds}
            inCartProductIds={inCartProductIds}
            cartLoaded={cartLoaded}
          />
        ) : (
          <div className="recommend-funds-popover-body-spacer" aria-hidden />
        )}
      </div>
    </div>
  );
}

export function RecommendFundsHoverCard({ trigger }: RecommendFundsHoverCardProps) {
  const navbarCopy = copy.navbar.recommendFunds;
  const reduceMotion = useReducedMotion();
  const { user, loading: authLoading } = useAuth();
  const kyc = useKycOptional();
  const { addFundToCart, addFundsToCart, adding } = useMfScreenerCartDrop();
  const [isPresent, setIsPresent] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [grainientPrimed, setGrainientPrimed] = useState(false);
  const [grainientReady, setGrainientReady] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandFrameRef = useRef<number | null>(null);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const queryEnabled = isPresent && !authLoading && Boolean(user);
  const { data, isLoading, isError, refetch, isFetching } = useFundsForYouQuery(queryEnabled);
  const cartEnabled = Boolean(user?.fund_movement_eligible);
  const { data: cart } = useMfCartQuery(cartEnabled);
  const cartLoaded = cartEnabled && cart !== undefined;

  const inCartProductIds = useMemo(() => {
    if (!cart) return new Set<string>();
    return getLumpsumCartProductIds(cart);
  }, [cart]);

  const fundsMissingFromCart = useMemo(() => {
    if (!data?.funds.length || !cart) return data?.funds ?? [];
    return filterNewLumpsumCartFunds(cart, data.funds);
  }, [cart, data?.funds]);

  const allFundsInCart =
    Boolean(data?.funds.length) && fundsMissingFromCart.length === 0 && inCartProductIds.size > 0;

  const allocation = useMemo(
    () => (data?.allocation ? mapFundsForYouAllocation(data.allocation) : []),
    [data?.allocation],
  );

  const contentState = useMemo(() => {
    if (authLoading || (queryEnabled && (isLoading || (isFetching && !data)))) {
      return "loading" as const;
    }

    if (!user) {
      return "sign_in" as const;
    }

    if (isError) {
      return "error" as const;
    }

    if (!data?.eligible) {
      return "blocked" as const;
    }

    return "success" as const;
  }, [authLoading, data, isError, isFetching, isLoading, queryEnabled, user]);

  const blockCopy = data?.block_reason ? resolveBlockStateCopy(data.block_reason) : null;

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearExpandFrame = useCallback(() => {
    if (expandFrameRef.current !== null) {
      cancelAnimationFrame(expandFrameRef.current);
      expandFrameRef.current = null;
    }
  }, []);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    clearExpandFrame();
    setGrainientPrimed(true);
    setIsPresent(true);
    expandFrameRef.current = requestAnimationFrame(() => {
      expandFrameRef.current = requestAnimationFrame(() => {
        expandFrameRef.current = null;
        setIsExpanded(true);
      });
    });
  }, [clearCloseTimer, clearExpandFrame]);

  const beginClose = useCallback(() => {
    clearCloseTimer();
    clearExpandFrame();
    if (reduceMotion) {
      setIsExpanded(false);
      setIsPresent(false);
      return;
    }
    setIsExpanded(false);
  }, [clearCloseTimer, clearExpandFrame, reduceMotion]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      beginClose();
    }, HOVER_CLOSE_DELAY_MS);
  }, [beginClose, clearCloseTimer]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        handleOpen();
        return;
      }

      scheduleClose();
    },
    [handleOpen, scheduleClose],
  );

  const handlePanelAnimationComplete = useCallback(() => {
    if (!isExpandedRef.current) {
      setIsPresent(false);
    }
  }, []);

  const handleAddFund = useCallback(
    (fund: FundsForYouFund) => {
      void addFundToCart(mapFundsForYouCartFund(fund));
    },
    [addFundToCart],
  );

  const handleAddAllToCart = useCallback(() => {
    if (!data?.funds.length || !cartEnabled || adding) return;

    if (cart) {
      const missingFunds = filterNewLumpsumCartFunds(cart, data.funds);
      if (missingFunds.length === 0) {
        toast.info(navbarCopy.allFundsInCart);
        return;
      }
      void addFundsToCart(missingFunds.map(mapFundsForYouCartFund));
      return;
    }

    void addFundsToCart(data.funds.map(mapFundsForYouCartFund));
  }, [addFundsToCart, adding, cart, cartEnabled, data?.funds, navbarCopy.allFundsInCart]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearExpandFrame();
    };
  }, [clearCloseTimer, clearExpandFrame]);

  useEffect(() => {
    if (isPresent) {
      setGrainientPrimed(true);
    }
  }, [isPresent]);

  useEffect(() => {
    if (!grainientPrimed || grainientReady) return;

    const timer = window.setTimeout(() => {
      setGrainientReady(true);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [grainientPrimed, grainientReady]);

  const handleGrainientReady = useCallback(() => {
    setGrainientReady(true);
  }, []);

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: isExpanded ? POPOVER_OPEN_DURATION_S : POPOVER_CLOSE_DURATION_S,
        ease: POPOVER_EASE,
      };

  const showFooter = contentState === "success";
  const showAllocationInfo = contentState === "success" && allocation.length > 0;

  return (
    <TooltipProvider delay={120}>
      <Popover open={isPresent} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger
          nativeButton={false}
          onClick={(event) => event.preventDefault()}
          onMouseEnter={handleOpen}
          onMouseLeave={scheduleClose}
          render={<div className="recommend-funds-popover-trigger inline-block" />}
        >
          {trigger}
        </PopoverTrigger>

        {isPresent ? (
          <PopoverContent
            align="center"
            side="bottom"
            sideOffset={6}
            initialFocus={false}
            finalFocus={false}
            className={cn(
              "recommend-funds-popover-shell relative z-50 w-auto overflow-visible border-0 bg-transparent p-0",
              "text-white shadow-none ring-0 outline-none",
              "!animate-none data-open:!animate-none data-closed:!animate-none",
              !isExpanded && "pointer-events-none",
            )}
            onMouseEnter={handleOpen}
            onMouseLeave={scheduleClose}
          >
            <div
              className="recommend-funds-popover-hover-bridge"
              aria-hidden
              onMouseEnter={handleOpen}
            />

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={
                isExpanded
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.96 }
              }
              transition={panelTransition}
              style={{ transformOrigin: "top center" }}
              onAnimationComplete={handlePanelAnimationComplete}
            >
              <BorderGlow
                {...RECOMMEND_FUNDS_BORDER_GLOW_PROPS}
                className={cn(
                  "recommend-funds-popover-border-glow w-[48rem]",
                  isExpanded && "recommend-funds-popover-border-glow-open",
                )}
              >
                {grainientPrimed ? (
                  <div
                    className={cn(
                      "recommend-funds-popover-grainient-layer",
                      grainientReady && "recommend-funds-popover-grainient-layer-ready",
                    )}
                    aria-hidden
                  >
                    <Grainient {...RECOMMEND_FUNDS_GRAINIENT_PROPS} onReady={handleGrainientReady} />
                  </div>
                ) : null}

                <div className="relative z-10 flex flex-col">
                  {contentState === "loading" ? <RecommendFundsLoadingBody /> : null}

                  {contentState === "sign_in" ? (
                    <RecommendFundsBlockBody
                      title={navbarCopy.signInTitle}
                      description={navbarCopy.signInDescription}
                    />
                  ) : null}

                  {contentState === "error" ? (
                    <RecommendFundsBlockBody
                      title={navbarCopy.errorTitle}
                      description={navbarCopy.errorDescription}
                      actionLabel={navbarCopy.errorRetry}
                      onAction={() => {
                        void refetch();
                      }}
                    />
                  ) : null}

                  {contentState === "blocked" && blockCopy ? (
                    <RecommendFundsBlockBody
                      title={blockCopy.title}
                      description={blockCopy.description}
                      actionLabel={blockCopy.actionLabel}
                      onAction={
                        data?.block_reason === "kyc_required"
                          ? () => kyc?.openDialog()
                          : undefined
                      }
                      actionHref={
                        data?.block_reason === "risk_profile_required"
                          ? "/dashboard/risk-profile/assessment"
                          : undefined
                      }
                    />
                  ) : null}

                  {contentState === "success" && data ? (
                    <RecommendFundsSuccessBody
                      funds={data.funds}
                      allocation={allocation}
                      portfolioStory={data.portfolio_story}
                      cartEnabled={cartEnabled}
                      adding={adding}
                      inCartProductIds={inCartProductIds}
                      cartLoaded={cartLoaded}
                      onAddFund={handleAddFund}
                    />
                  ) : null}

                  {showFooter ? (
                    <div className="recommend-funds-popover-footer">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              className="h-10 min-w-0 flex-1 gap-2 border border-white/20 bg-white text-[var(--zynd-purple-dark)] shadow-none hover:bg-white/95 disabled:pointer-events-auto disabled:opacity-55"
                              disabled={
                                !cartEnabled || adding || !data?.funds.length || allFundsInCart
                              }
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={(event) => {
                                event.preventDefault();
                                handleAddAllToCart();
                              }}
                            />
                          }
                        >
                          {adding ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <ShoppingCart className="size-4" aria-hidden />
                          )}
                          {fundsMissingFromCart.length > 0 &&
                          fundsMissingFromCart.length < (data?.funds.length ?? 0)
                            ? navbarCopy.addRemainingToCartLabel
                            : navbarCopy.addToCartLabel}
                        </TooltipTrigger>
                        {!cartEnabled ? (
                          <TooltipContent
                            side="top"
                            align="end"
                            className="max-w-[13rem] text-left leading-snug"
                          >
                            {navbarCopy.cartDisabledHint}
                          </TooltipContent>
                        ) : null}
                      </Tooltip>

                      {showAllocationInfo ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                className="recommend-funds-popover-info-trigger"
                                aria-label={navbarCopy.allocationInfoLabel}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={(event) => event.preventDefault()}
                              />
                            }
                          >
                            <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="end"
                            sideOffset={8}
                            className="max-w-[13rem] text-left leading-snug"
                          >
                            {navbarCopy.allocationInfo}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </BorderGlow>
            </motion.div>
          </PopoverContent>
        ) : null}
      </Popover>
    </TooltipProvider>
  );
}
