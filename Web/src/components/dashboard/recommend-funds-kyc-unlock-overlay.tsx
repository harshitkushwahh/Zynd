"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  ChevronRight,
  Coins,
  IdCard,
  Info,
  Landmark,
  Leaf,
  PieChart,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import "@/styles/zynd-recommend-funds-kyc-overlay.css";
import { RECOMMEND_FUNDS_PAGE_GRAINIENT_PROPS } from "@/components/dashboard/recommend-funds-theme";
import { Button } from "@/components/ui/button";
import { Grainient } from "@/components/ui/grainient";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const GLITTER_COUNT = 44;
const OVERLAY_EASE = [0.16, 1, 0.3, 1] as const;
const OPEN_DURATION_S = 0.5;
const CLOSE_DURATION_S = 0.34;

type GlitterSpec = {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  tone: number;
};

function buildGlitter(count: number): GlitterSpec[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    size: 2 + Math.random() * 5,
    delay: -Math.random() * 16,
    duration: 11 + Math.random() * 9,
    drift: (Math.random() - 0.5) * 110,
    tone: Math.floor(Math.random() * 3),
  }));
}

type PreviewFund = {
  id: string;
  name: string;
  meta: string;
  category: string;
  returnLabel: string;
  tone: "green" | "orange" | "blue" | "pink" | "violet";
  icon: LucideIcon;
  spark: number[];
};

/** Placeholder rows shown behind the lock. Names are blurred on purpose. */
const PREVIEW_FUNDS: PreviewFund[] = [
  {
    id: "large-cap",
    name: "Bluechip Growth Fund",
    meta: "Direct · Growth · Large Cap",
    category: "Large Cap",
    returnLabel: "+18.4%",
    tone: "green",
    icon: Leaf,
    spark: [12, 18, 15, 22, 20, 27, 25, 31, 29, 36],
  },
  {
    id: "flexi-cap",
    name: "Opportunities Flexi Fund",
    meta: "Direct · Growth · Flexi Cap",
    category: "Flexi Cap",
    returnLabel: "+16.2%",
    tone: "orange",
    icon: BarChart3,
    spark: [10, 14, 13, 19, 17, 23, 21, 26, 28, 33],
  },
  {
    id: "mid-cap",
    name: "Emerging Leaders Fund",
    meta: "Direct · Growth · Mid Cap",
    category: "Mid Cap",
    returnLabel: "+21.3%",
    tone: "blue",
    icon: Coins,
    spark: [8, 15, 12, 20, 24, 21, 29, 27, 34, 38],
  },
  {
    id: "small-cap",
    name: "Small Cap Discovery Fund",
    meta: "Direct · Growth · Small Cap",
    category: "Small Cap",
    returnLabel: "+24.1%",
    tone: "pink",
    icon: PieChart,
    spark: [6, 11, 16, 13, 22, 26, 24, 32, 35, 41],
  },
  {
    id: "debt",
    name: "Short Duration Debt Fund",
    meta: "Direct · Growth · Debt",
    category: "Debt Fund",
    returnLabel: "+7.9%",
    tone: "violet",
    icon: Zap,
    spark: [14, 15, 16, 16, 18, 19, 19, 21, 22, 23],
  },
];

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function GlitterField({ specs }: { specs: GlitterSpec[] }) {
  return (
    <div className="rf-kyc-overlay-glitter" aria-hidden>
      {specs.map((spec) => (
        <span
          key={spec.id}
          className={cn("rf-kyc-overlay-glitter-dot", `rf-kyc-overlay-glitter-dot-${spec.tone}`)}
          style={
            {
              left: `${spec.left}%`,
              width: `${spec.size}px`,
              height: `${spec.size}px`,
              animationDelay: `${spec.delay}s, ${spec.delay / 2}s`,
              animationDuration: `${spec.duration}s, ${1.8 + (spec.id % 5) * 0.35}s`,
              "--rf-glitter-drift": `${spec.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Sparkline({ points, id }: { points: number[]; id: string }) {
  const width = 72;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gradientId = `rf-kyc-spark-${id}`;

  return (
    <svg
      className="rf-kyc-overlay-spark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#4ade80" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewFundRow({ fund, index }: { fund: PreviewFund; index: number }) {
  const Icon = fund.icon;
  return (
    <div
      className="rf-kyc-overlay-fund"
      style={{ "--rf-row-index": index } as React.CSSProperties}
      aria-hidden
    >
      <span className={cn("rf-kyc-overlay-fund-icon", `rf-kyc-overlay-fund-icon-${fund.tone}`)}>
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
      <span className="rf-kyc-overlay-fund-text">
        <span className="rf-kyc-overlay-fund-name">{fund.name}</span>
        <span className="rf-kyc-overlay-fund-meta">{fund.meta}</span>
      </span>
      <span className="rf-kyc-overlay-fund-chip">{fund.category}</span>
      <Sparkline points={fund.spark} id={fund.id} />
      <span className="rf-kyc-overlay-fund-return">{fund.returnLabel}</span>
      <ChevronRight className="rf-kyc-overlay-fund-chevron size-4" strokeWidth={2} />
    </div>
  );
}

function KycIllustration() {
  return (
    <div className="rf-kyc-illustration" aria-hidden>
      <span className="rf-kyc-illustration-glow" />
      <span className="rf-kyc-illustration-orbit" />

      <div className="rf-kyc-illustration-card">
        <span className="rf-kyc-illustration-card-tab" />
        <span className="rf-kyc-illustration-card-avatar">
          <UserRound className="size-6" strokeWidth={2} />
        </span>
        <span className="rf-kyc-illustration-card-lines">
          <span className="rf-kyc-illustration-card-line rf-kyc-illustration-card-line-wide" />
          <span className="rf-kyc-illustration-card-line" />
          <span className="rf-kyc-illustration-card-line rf-kyc-illustration-card-line-short" />
        </span>
      </div>

      <span className="rf-kyc-illustration-shield">
        <ShieldCheck className="size-7" strokeWidth={2.25} />
      </span>

      <span className="rf-kyc-illustration-badge rf-kyc-illustration-badge-pan">
        <span className="rf-kyc-illustration-badge-label">PAN</span>
        <IdCard className="size-4" strokeWidth={2} />
      </span>
      <span className="rf-kyc-illustration-badge rf-kyc-illustration-badge-bank">
        <Landmark className="size-5" strokeWidth={2} />
      </span>
      <span className="rf-kyc-illustration-badge rf-kyc-illustration-badge-user">
        <UserRound className="size-4" strokeWidth={2} />
      </span>
    </div>
  );
}

type OverlayPageProps = {
  onClose: () => void;
  onCompleteKyc?: () => void;
};

function RecommendFundsKycUnlockPage({ onClose, onCompleteKyc }: OverlayPageProps) {
  const navbarCopy = copy.navbar.recommendFunds;
  const overlayCopy = navbarCopy.kycOverlay;
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const [glitter] = useState(() => buildGlitter(GLITTER_COUNT));
  const [grainientReady, setGrainientReady] = useState(false);

  const handleGrainientReady = useCallback(() => {
    setGrainientReady(true);
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const rootTransition = reduceMotion
    ? { duration: 0 }
    : { duration: OPEN_DURATION_S, ease: OVERLAY_EASE };
  const rootExitTransition = reduceMotion
    ? { duration: 0 }
    : { duration: CLOSE_DURATION_S, ease: [0.4, 0, 1, 1] as const };
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : { duration: OPEN_DURATION_S + 0.1, ease: OVERLAY_EASE, delay: 0.06 };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : { duration: CLOSE_DURATION_S * 0.8, ease: [0.4, 0, 1, 1] as const };

  return (
    <motion.div
      className="rf-kyc-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1, transition: rootTransition }}
      exit={{ opacity: 0, transition: rootExitTransition }}
    >
      <div
        className={cn("rf-kyc-overlay-bg", grainientReady && "rf-kyc-overlay-bg-ready")}
        aria-hidden
      >
        <Grainient {...RECOMMEND_FUNDS_PAGE_GRAINIENT_PROPS} onReady={handleGrainientReady} />
      </div>
      <div className="rf-kyc-overlay-vignette" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-a" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-b" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-c" aria-hidden />
      <GlitterField specs={glitter} />

      <button
        type="button"
        className="rf-kyc-overlay-close"
        aria-label={overlayCopy.closeLabel}
        onClick={onClose}
      >
        <X className="size-4" strokeWidth={2.25} aria-hidden />
      </button>

      <motion.div
        className="rf-kyc-overlay-content"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0, transition: contentTransition }}
        exit={{ opacity: 0, y: 16, transition: contentExitTransition }}
      >
        <div className="rf-kyc-overlay-hero">
          <span className="rf-kyc-overlay-badge">
            <Sparkles className="size-3.5" strokeWidth={2.25} aria-hidden />
            {navbarCopy.label}
          </span>
          <KycIllustration />
          <h2 id={titleId} className="rf-kyc-overlay-title">
            {navbarCopy.kycRequiredTitle}
          </h2>
          <p id={descriptionId} className="rf-kyc-overlay-description">
            {navbarCopy.kycRequiredDescription}
          </p>
          <div className="rf-kyc-overlay-actions">
            <Button
              type="button"
              className="rf-kyc-overlay-primary"
              onClick={() => {
                onClose();
                onCompleteKyc?.();
              }}
            >
              <ShieldCheck className="size-4" strokeWidth={2.25} aria-hidden />
              {navbarCopy.kycRequiredAction}
            </Button>
            <Button type="button" variant="ghost" className="rf-kyc-overlay-secondary" onClick={onClose}>
              {overlayCopy.laterLabel}
            </Button>
          </div>
        </div>

        <div className="rf-kyc-overlay-funds">
          <div className="rf-kyc-overlay-funds-head">
            <p className="rf-kyc-overlay-funds-title">{overlayCopy.topFundsTitle}</p>
            <p className="rf-kyc-overlay-funds-subtitle">{overlayCopy.topFundsSubtitle}</p>
          </div>
          <div className="rf-kyc-overlay-funds-list">
            {PREVIEW_FUNDS.map((fund, index) => (
              <PreviewFundRow key={fund.id} fund={fund} index={index} />
            ))}
          </div>
          <p className="rf-kyc-overlay-funds-note">
            <Info className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span>{overlayCopy.topFundsNote}</span>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

type RecommendFundsKycUnlockOverlayProps = OverlayPageProps & {
  open: boolean;
};

export function RecommendFundsKycUnlockOverlay({
  open,
  onClose,
  onCompleteKyc,
}: RecommendFundsKycUnlockOverlayProps) {
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <RecommendFundsKycUnlockPage
          key="rf-kyc-unlock-page"
          onClose={onClose}
          onCompleteKyc={onCompleteKyc}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
