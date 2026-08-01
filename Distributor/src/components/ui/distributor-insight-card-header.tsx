"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type DistributorInsightCardHeaderProps = {
  eyebrow: string;
  title: string;
  info?: string;
  className?: string;
  titleAs?: "h2" | "h3" | "p";
  trailing?: ReactNode;
};

export function DistributorInsightCardHeader({
  eyebrow,
  title,
  info,
  className,
  titleAs: TitleTag = "h2",
  trailing,
}: DistributorInsightCardHeaderProps) {
  return (
    <div className={cn("distributor-insight-card-header", className)}>
      <div className="distributor-insight-card-header__title-block">
        <p className="distributor-insight-card-header__eyebrow">{eyebrow}</p>
        <div className="distributor-insight-card-header__title-row">
          <TitleTag className="distributor-insight-card-header__title">{title}</TitleTag>
          {info ? (
            <span
              className="distributor-insight-card-header__info"
              title={info}
              aria-label={info}
            >
              <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
            </span>
          ) : null}
          {trailing}
        </div>
      </div>
    </div>
  );
}
