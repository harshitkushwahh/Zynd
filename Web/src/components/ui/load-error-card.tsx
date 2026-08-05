"use client";

import type { LucideIcon, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LOAD_ERROR_CARD_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card";

type LoadErrorCardProps = {
  title: string;
  description: string;
  retryLabel: string;
  onRetry?: () => void;
  retryLoading?: boolean;
  backAction?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function LoadErrorCard({
  title,
  description,
  retryLabel,
  onRetry,
  retryLoading = false,
  backAction,
  icon: Icon = AlertCircle,
  className,
}: LoadErrorCardProps) {
  return (
    <section className={cn(LOAD_ERROR_CARD_CLASS, "p-5 sm:p-6", className)}>
      <div className="flex flex-col items-center px-2 py-4 text-center sm:px-4 sm:py-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:size-14">
          <Icon className="size-6 sm:size-7" strokeWidth={2.25} aria-hidden />
        </div>

        <h2 className="mt-4 text-body font-semibold tracking-tight text-foreground sm:text-h4">{title}</h2>
        <p className="mt-2 max-w-md text-compact leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {onRetry ? (
            <Button type="button" disabled={retryLoading} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {backAction}
        </div>
      </div>
    </section>
  );
}
