"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BrandDialogMaxWidth = "md" | "lg";
type BrandDialogHeaderDensity = "default" | "compact";

export type BrandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  maxWidth?: BrandDialogMaxWidth;
  closeTone?: "default" | "on-brand";
  showCloseButton?: boolean;
  headerDensity?: BrandDialogHeaderDensity;
  headerReserveCloseSpace?: boolean;
  className?: string;
  overlayClassName?: string;
};

const maxWidthClass: Record<BrandDialogMaxWidth, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
};

export function BrandDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  maxWidth = "md",
  closeTone = "on-brand",
  showCloseButton = true,
  headerDensity = "default",
  headerReserveCloseSpace = false,
  className,
  overlayClassName,
}: BrandDialogProps) {
  const isCompact = headerDensity === "compact";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(maxWidthClass[maxWidth], "overflow-hidden p-0", className)}
        closeTone={closeTone}
        showCloseButton={showCloseButton}
        overlayClassName={overlayClassName}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div
          className={cn(
            "relative overflow-hidden bg-gradient-brand",
            isCompact ? "px-5 py-4" : "px-6 py-5",
            headerReserveCloseSpace && "pr-14",
          )}
        >
          <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
          <div
            className={cn(
              "relative z-10 flex items-start",
              isCompact ? "gap-2.5" : "gap-3",
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-[var(--blur-sm)]",
                isCompact ? "size-10" : "size-11",
              )}
            >
              <Icon
                className={cn(
                  "text-primary-foreground",
                  isCompact ? "size-4" : "size-5",
                )}
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-h4 font-semibold leading-tight text-primary-foreground">{title}</h2>
              {description ? (
                <p
                  className={cn(
                    "text-caption leading-relaxed text-primary-foreground/85",
                    isCompact ? "mt-0.5 leading-snug" : "mt-1",
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {children}
      </DialogContent>
    </Dialog>
  );
}

type BrandDialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function BrandDialogFooter({ children, className }: BrandDialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
