"use client";

import { XIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

export type SplitFormDialogPoint = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName: string;
  extra?: ReactNode;
};

type SplitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  heading?: string;
  illustration: ReactNode;
  stepProgress?: ReactNode;
  rightHeader?: ReactNode;
  points: SplitFormDialogPoint[];
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  /** Overrides default grid height (e.g. tighter max height for compact flows). */
  gridClassName?: string;
  contentClassName?: string;
  /** Vertically center children in the space below the right header. */
  centerContent?: boolean;
};

export function SplitFormDialog({
  open,
  onOpenChange,
  title,
  heading,
  illustration,
  stepProgress,
  rightHeader,
  points,
  children,
  footer,
  className,
  gridClassName,
  contentClassName,
  centerContent = false,
}: SplitFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-w-[min(100%,56rem)] overflow-hidden p-0",
          ZYND_3XL_RADIUS_CLASS,
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div
          className={cn(
            "grid h-auto min-h-0 max-h-[min(90vh,44rem)] w-full min-w-0 grid-cols-1 overflow-hidden md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]",
            gridClassName,
          )}
        >
          <aside className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-border/70 bg-muted/20 px-6 py-6 sm:px-8 sm:py-7 md:border-r md:border-b-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
            />
            <div className="relative flex justify-center">{illustration}</div>
            {stepProgress ? <div className="relative mt-5">{stepProgress}</div> : null}
            {heading ? (
              <h2 className="relative mt-4 text-h3 font-semibold tracking-tight text-foreground">{heading}</h2>
            ) : null}
            <ul
              className={cn(
                "relative space-y-5",
                stepProgress ? "mt-5" : heading ? "mt-5" : "mt-8 md:mt-auto md:pt-8",
              )}
            >
              {points.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        point.iconClassName,
                      )}
                    >
                      <Icon className="size-4" strokeWidth={2.25} aria-hidden />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-compact font-semibold text-foreground">{point.title}</span>
                      {point.description ? (
                        <span className="mt-0.5 block text-caption leading-relaxed text-muted-foreground">
                          {point.description}
                        </span>
                      ) : null}
                      {point.extra ? <div className="mt-2.5">{point.extra}</div> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-popover">
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-4 right-4 z-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                />
              }
            >
              <XIcon className="size-4" strokeWidth={2} />
            </DialogClose>

            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-6 pt-10 pb-2 sm:px-7",
                contentClassName,
              )}
            >
              {rightHeader ? <div className="mb-4 shrink-0 pr-8">{rightHeader}</div> : null}
              <div
                className={cn(
                  centerContent && "flex min-h-0 flex-1 flex-col justify-center",
                )}
              >
                {children}
              </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              {footer}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
