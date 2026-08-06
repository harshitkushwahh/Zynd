"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type OverviewCompactCardHeaderProps = {
  title: string;
  href?: string;
  ariaLabel?: string;
  className?: string;
  /** When the card root is a Link, arrow picks up group-hover styles. */
  groupHover?: boolean;
};

export function OverviewCompactCardHeader({
  title,
  href,
  ariaLabel,
  className,
  groupHover = false,
}: OverviewCompactCardHeaderProps) {
  const arrowClassName = cn(
    "size-3.5 shrink-0 text-muted-foreground",
    groupHover && "transition-colors group-hover:text-primary",
  );

  return (
    <div className={cn("flex shrink-0 items-start justify-between gap-2", className)}>
      <p className="text-caption font-semibold text-foreground">{title}</p>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          aria-label={ariaLabel}
        >
          <ArrowUpRight className={arrowClassName} strokeWidth={2.25} />
        </Link>
      ) : (
        <ArrowUpRight className={arrowClassName} strokeWidth={2.25} />
      )}
    </div>
  );
}
