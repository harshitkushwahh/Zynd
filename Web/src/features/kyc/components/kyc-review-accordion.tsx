"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycReviewAccordionEmptyTone = "neutral" | "warning";

type KycReviewAccordionProps = {
  title: string;
  summary?: string;
  empty?: boolean;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  emptyTone?: KycReviewAccordionEmptyTone;
  emptySummary?: string;
  emptyContent?: React.ReactNode;
  children: React.ReactNode;
};

export function KycReviewAccordion({
  title,
  summary,
  empty = false,
  defaultOpen = false,
  icon,
  badge,
  emptyTone = "neutral",
  emptySummary,
  emptyContent,
  children,
}: KycReviewAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `kyc-review-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const isWarningEmpty = empty && emptyTone === "warning";
  const collapsedHint = empty
    ? emptySummary ?? copy.kyc.review.notProvided
    : summary;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border bg-card shadow-zynd-low",
        isWarningEmpty ? "border-warning/55 bg-warning/[0.03]" : "border-border",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
          isWarningEmpty ? "hover:bg-warning/[0.06]" : "hover:bg-muted/40",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {icon ? (
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              isWarningEmpty ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-foreground">{title}</p>
          {!open && collapsedHint ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[11px]",
                empty && isWarningEmpty ? "text-warning" : "text-muted-foreground",
              )}
            >
              {collapsedHint}
            </p>
          ) : null}
        </div>

        {badge ? <div className="shrink-0">{badge}</div> : null}

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border/60 px-3 pb-3 pt-2">
          {empty ? (
            emptyContent ?? (
              <p className="py-2 text-[11px] text-muted-foreground">{copy.kyc.review.notProvided}</p>
            )
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}
