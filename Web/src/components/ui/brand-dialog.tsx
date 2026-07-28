"use client";

import type { LucideIcon } from "lucide-react";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BrandDialogMaxWidth = "md" | "lg" | "xl";
type BrandDialogHeaderDensity = "default" | "compact";
type BrandDialogHeaderVariant = "brand" | "light";

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
  headerVariant?: BrandDialogHeaderVariant;
  iconClassName?: string;
  headerReserveCloseSpace?: boolean;
  headerAction?: ReactNode;
  className?: string;
  overlayClassName?: string;
};

const maxWidthClass: Record<BrandDialogMaxWidth, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-5xl",
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
  headerVariant = "brand",
  iconClassName,
  headerReserveCloseSpace = false,
  headerAction,
  className,
  overlayClassName,
}: BrandDialogProps) {
  const isCompact = headerDensity === "compact";
  const isLightHeader = headerVariant === "light";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(maxWidthClass[maxWidth], "!flex flex-col overflow-hidden p-0", className)}
        closeTone={closeTone}
        showCloseButton={false}
        overlayClassName={overlayClassName}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div
          className={cn(
            "relative shrink-0 overflow-hidden border-b border-border/70",
            isLightHeader ? "bg-background" : "bg-gradient-brand",
            isCompact ? "px-5 py-4" : "px-6 py-5",
            headerReserveCloseSpace && !showCloseButton && "pr-14",
          )}
        >
          {!isLightHeader ? (
            <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
          ) : null}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div
              className={cn(
                "flex min-w-0 items-center",
                isCompact ? "gap-2.5" : "gap-3",
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-[var(--radius-card)] border",
                  isLightHeader
                    ? cn(
                        "size-11",
                        iconClassName ?? "border-border/70 bg-muted/30 text-muted-foreground",
                      )
                    : cn(
                        "border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-[var(--blur-sm)]",
                        isCompact ? "size-10" : "size-11",
                      ),
                )}
              >
                <Icon
                  className={cn(
                    isLightHeader ? "size-5" : isCompact ? "size-4" : "size-5",
                    !isLightHeader && "text-primary-foreground",
                  )}
                />
              </div>
              <div className="min-w-0">
                <h2
                  className={cn(
                    "text-h4 font-semibold leading-tight",
                    isLightHeader ? "text-foreground" : "text-primary-foreground",
                  )}
                >
                  {title}
                </h2>
                {description ? (
                  <p
                    className={cn(
                      "text-caption leading-relaxed",
                      isLightHeader
                        ? "mt-0.5 text-muted-foreground"
                        : "text-primary-foreground/85",
                      isCompact ? "mt-0.5 leading-snug" : "mt-1",
                    )}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            {headerAction || showCloseButton ? (
              <div className="flex shrink-0 items-center gap-2">
                {headerAction}
                {showCloseButton ? (
                  <DialogClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                          "shrink-0 rounded-[var(--radius-control)]",
                          isLightHeader || closeTone === "default"
                            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                            : "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                        )}
                        aria-label="Close"
                      />
                    }
                  >
                    <XIcon className="size-4" strokeWidth={2} />
                  </DialogClose>
                ) : null}
              </div>
            ) : null}
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
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
