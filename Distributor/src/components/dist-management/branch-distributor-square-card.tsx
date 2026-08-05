"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

type BranchDistributorSquareCardTone = "default" | "accent" | "soft";

type BranchDistributorSquareMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: BranchDistributorSquareCardTone;
  className?: string;
  valueTitle?: string;
};

export function BranchDistributorSquareMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  className,
  valueTitle,
}: BranchDistributorSquareMetricCardProps) {
  return (
    <article
      className={cn(
        "distributor-branch-distributor-square-card",
        tone === "accent" && "distributor-branch-distributor-square-card--accent",
        tone === "soft" && "distributor-branch-distributor-square-card--soft",
        className,
      )}
    >
      <div className="distributor-branch-distributor-square-card__top">
        <span className="distributor-branch-distributor-square-card__icon" aria-hidden>
          <Icon strokeWidth={2.25} />
        </span>
      </div>
      <div className="distributor-branch-distributor-square-card__body">
        <p
          className="distributor-branch-distributor-square-card__value tabular-nums"
          title={valueTitle ?? value}
        >
          {value}
        </p>
        <p className="distributor-branch-distributor-square-card__label">{label}</p>
        {hint ? (
          <p className="distributor-branch-distributor-square-card__hint">{hint}</p>
        ) : null}
      </div>
    </article>
  );
}

type BranchDistributorSquareCopyCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: BranchDistributorSquareCardTone;
  className?: string;
};

export function BranchDistributorSquareCopyCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  className,
}: BranchDistributorSquareCopyCardProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      className={cn(
        "distributor-branch-distributor-square-card distributor-branch-distributor-square-card--copy",
        tone === "accent" && "distributor-branch-distributor-square-card--accent",
        copied && "distributor-branch-distributor-square-card--copied",
        className,
      )}
      onClick={() => void onCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label} ${value}`}
    >
      <div className="distributor-branch-distributor-square-card__top">
        <span className="distributor-branch-distributor-square-card__icon" aria-hidden>
          <Icon strokeWidth={2.25} />
        </span>
        <span className="distributor-branch-distributor-square-card__copy" aria-hidden>
          {copied ? <Check strokeWidth={2.5} /> : <Copy strokeWidth={2.25} />}
        </span>
      </div>
      <div className="distributor-branch-distributor-square-card__body">
        <p className="distributor-branch-distributor-square-card__value font-mono tabular-nums">
          {value}
        </p>
        <p className="distributor-branch-distributor-square-card__label">{label}</p>
      </div>
    </button>
  );
}

type BranchDistributorSquareCardGridProps = {
  children: ReactNode;
  className?: string;
  columns?: 2 | 4;
};

export function BranchDistributorSquareCardGrid({
  children,
  className,
  columns = 2,
}: BranchDistributorSquareCardGridProps) {
  return (
    <div
      className={cn(
        "distributor-branch-distributor-square-grid",
        columns === 4 && "distributor-branch-distributor-square-grid--four",
        className,
      )}
    >
      {children}
    </div>
  );
}
