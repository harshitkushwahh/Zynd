"use client";

import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Lock,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Target,
} from "lucide-react";

import "@/styles/zynd-recommend-funds-button.css";
import "@/styles/zynd-recommend-funds-kyc-overlay.css";
import { RecommendFundsFullPageShell } from "@/components/dashboard/recommend-funds-full-page-shell";
import { RecommendFundsRiskAssessmentIllustration } from "@/components/dashboard/recommend-funds-risk-assessment-illustration";
import { Button } from "@/components/ui/button";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { copy } from "@/shared/config/copy";

const RISK_LOCKED_DUMMY_FUNDS = [
  { name: "HDFC Flexi Cap Fund", amcName: "HDFC Mutual Fund", amcSlug: "hdfc-mutual-fund" },
  { name: "ICICI Prudential Bluechip Fund", amcName: "ICICI Prudential Mutual Fund", amcSlug: "icici-prudential-mutual-fund" },
  { name: "SBI Conservative Hybrid Fund", amcName: "SBI Mutual Fund", amcSlug: "sbi-mutual-fund" },
  { name: "Axis Short Duration Fund", amcName: "Axis Mutual Fund", amcSlug: "axis-mutual-fund" },
  { name: "Nippon India Gold Savings Fund", amcName: "Nippon India Mutual Fund", amcSlug: "nippon-india-mutual-fund" },
] as const;

const RISK_LOCKED_DUMMY_ALLOCATION = [
  { id: "equity", label: "Equity", valuePct: 72, color: "#38bdf8" },
  { id: "debt", label: "Debt", valuePct: 18, color: "#34d399" },
  { id: "hybrid", label: "Hybrid", valuePct: 6, color: "#fbbf24" },
  { id: "gold", label: "Gold", valuePct: 4, color: "#fb7185" },
] as const;

const RISK_LOCKED_DUMMY_STATUS = [
  { kind: "portfolio", count: 2, labelKey: "portfolioStatusInPortfolio" },
  { kind: "cart", count: 1, labelKey: "portfolioStatusInCart" },
  { kind: "pending", count: 2, labelKey: "portfolioStatusNotAdded" },
] as const;

const RISK_PROFILE_ASSESSMENT_HREF = "/dashboard/risk-profile/assessment";

function RecommendFundsRiskLockedPreview() {
  const navbarCopy = copy.navbar.recommendFunds;
  const allocationCopy = copy.dashboard.portfolio;

  return (
    <div className="recommend-funds-popover-success" aria-hidden>
      <div className="recommend-funds-popover-body">
        <div className="recommend-funds-popover-funds-column">
          <div className="space-y-0.5 px-1 pb-1 pt-2">
            {RISK_LOCKED_DUMMY_FUNDS.map((fund) => (
              <div key={fund.name} className="recommend-funds-popover-fund-row">
                <MfFundAmcAvatar
                  amcLogoUrl={null}
                  amcSlug={fund.amcSlug}
                  amcName={fund.amcName}
                  size="sm"
                  className="border-white/20 bg-white/15 text-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="recommend-funds-popover-fund-name">{fund.name}</p>
                </div>
                <span className="recommend-funds-popover-fund-action recommend-funds-popover-fund-action-default inline-flex items-center justify-center">
                  <Plus className="size-4" strokeWidth={2.25} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="recommend-funds-popover-allocation-panel">
          <p className="recommend-funds-popover-allocation-title">{allocationCopy.allocationTitle}</p>
          <div className="recommend-funds-popover-allocation-chart-wrap">
            <div className="recommend-funds-popover-locked-donut" />
            <div className="recommend-funds-popover-allocation-chart-center">100%</div>
          </div>
          <div className="recommend-funds-popover-allocation-chip-swiper">
            <div className="recommend-funds-popover-allocation-chip-track scrollbar-none">
              {RISK_LOCKED_DUMMY_ALLOCATION.map((slice) => (
                <span key={slice.id} className="recommend-funds-popover-allocation-chip">
                  <span
                    className="recommend-funds-popover-allocation-chip-dot"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="recommend-funds-popover-allocation-chip-label">{slice.label}</span>
                  <span className="recommend-funds-popover-allocation-chip-value">{slice.valuePct}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="recommend-funds-popover-portfolio-story">
          <div className="recommend-funds-popover-portfolio-story-content">
            <div className="recommend-funds-popover-portfolio-status">
              <p className="recommend-funds-popover-portfolio-status-title">
                {navbarCopy.portfolioStatusTitle}
              </p>
              <div className="recommend-funds-popover-portfolio-status-progress">
                <div
                  className="recommend-funds-popover-portfolio-status-progress-fill"
                  style={{ width: "40%" }}
                />
              </div>
              <div className="recommend-funds-popover-portfolio-status-list">
                {RISK_LOCKED_DUMMY_STATUS.map((row) => (
                  <div key={row.kind} className="recommend-funds-popover-portfolio-status-row">
                    <span
                      className={`recommend-funds-popover-portfolio-status-dot recommend-funds-popover-portfolio-status-dot-${row.kind}`}
                    />
                    <span className="recommend-funds-popover-portfolio-status-count">{row.count}</span>
                    <span className="recommend-funds-popover-portfolio-status-label">
                      {navbarCopy[row.labelKey]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="recommend-funds-popover-portfolio-story-why">
              <p className="recommend-funds-popover-portfolio-story-why-label">
                {navbarCopy.portfolioStoryWhyLabel}
              </p>
              <p className="recommend-funds-popover-portfolio-story-why-copy">
                {navbarCopy.riskRequiredDummyStory}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="recommend-funds-popover-footer">
        <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white text-[var(--zynd-purple-dark)]">
          <ShoppingCart className="size-4" />
          {navbarCopy.addToCartLabel}
        </span>
      </div>
    </div>
  );
}

type RecommendFundsRiskLockedFullPageProps = {
  onClose: () => void;
  closeLabel: string;
};

const RISK_FEATURE_ICONS = [Target, BarChart3, ShieldCheck] as const;

export function RecommendFundsRiskLockedFullPage({
  onClose,
  closeLabel,
}: RecommendFundsRiskLockedFullPageProps) {
  const navbarCopy = copy.navbar.recommendFunds;
  const pageCopy = navbarCopy.riskAssessmentPage;

  return (
    <RecommendFundsFullPageShell
      onClose={onClose}
      closeLabel={closeLabel}
      contentClassName="rf-funds-page-content-hero rf-kyc-overlay-content-risk"
    >
      <RecommendFundsRiskAssessmentIllustration />

      <div className="rf-kyc-overlay-hero rf-risk-overlay-hero">
        <span className="rf-kyc-overlay-badge">
          <BarChart3 className="size-3.5" strokeWidth={2.25} aria-hidden />
          {pageCopy.badge}
        </span>
        <h1 className="rf-kyc-overlay-title">{pageCopy.title}</h1>
        <p className="rf-kyc-overlay-description">{pageCopy.description}</p>

        <div className="rf-risk-overlay-features">
          {pageCopy.features.map((feature, index) => {
            const Icon = RISK_FEATURE_ICONS[index] ?? Target;
            return (
              <div key={feature.label} className="rf-risk-overlay-feature">
                <span className="rf-risk-overlay-feature-icon">
                  <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="rf-risk-overlay-feature-label">{feature.label}</span>
              </div>
            );
          })}
        </div>

        <div className="rf-risk-overlay-actions">
          <Button
            type="button"
            size="auth"
            className="rf-kyc-overlay-primary w-full max-w-none"
            nativeButton={false}
            render={<Link href={RISK_PROFILE_ASSESSMENT_HREF} className="w-full" />}
          >
            {pageCopy.primaryAction}
            <ChevronRight className="size-4" strokeWidth={2.25} aria-hidden />
          </Button>
          <Button type="button" variant="ghost" className="rf-risk-overlay-later" onClick={onClose}>
            {pageCopy.laterLabel}
          </Button>
        </div>
      </div>
    </RecommendFundsFullPageShell>
  );
}

export function RecommendFundsRiskLockedBody() {
  const navbarCopy = copy.navbar.recommendFunds;

  return (
    <div className="recommend-funds-popover-locked">
      <div className="recommend-funds-popover-locked-preview">
        <RecommendFundsRiskLockedPreview />
      </div>
      <div className="pointer-events-none absolute inset-0 sip-chart-overlay recommend-funds-popover-locked-veil" />
      <div className="recommend-funds-popover-locked-overlay">
        <div className="recommend-funds-popover-locked-panel sip-lock-panel">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-4" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0 text-center">
            <p className="text-compact font-semibold text-foreground">{navbarCopy.riskRequiredTitle}</p>
            <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
              {navbarCopy.riskRequiredDescription}
            </p>
          </div>
          <Button
            type="button"
            nativeButton={false}
            className="recommend-funds-popover-state-action"
            render={<Link href={RISK_PROFILE_ASSESSMENT_HREF} />}
            onMouseDown={(event) => event.preventDefault()}
          >
            {navbarCopy.riskRequiredAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
