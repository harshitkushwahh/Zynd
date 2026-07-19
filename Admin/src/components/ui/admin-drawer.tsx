"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  ADMIN_DIALOG_DESCRIPTION_CLASS,
  ADMIN_DIALOG_TITLE_CLASS,
} from "@/components/dashboard/admin-typography";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ADMIN_DRAWER_WIDTH_CLASS = {
  md: "w-full sm:max-w-lg",
  lg: "w-full sm:max-w-xl",
  xl: "w-full sm:max-w-2xl",
} as const;

export type AdminDrawerSize = keyof typeof ADMIN_DRAWER_WIDTH_CLASS;

export function AdminDrawer({
  open,
  onOpenChange,
  onClose,
  title,
  subtitle,
  description,
  icon: Icon,
  children,
  size = "lg",
  headerAside,
  footer,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  size?: AdminDrawerSize;
  headerAside?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (!next) onClose?.();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "flex h-full flex-col gap-0 border-l border-border bg-card p-0 shadow-zynd-high",
          ADMIN_DRAWER_WIDTH_CLASS[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
                <Icon className="size-5" strokeWidth={2} />
              </div>
            ) : null}
            <div className="min-w-0">
              {subtitle ? (
                <SheetDescription className={ADMIN_DIALOG_DESCRIPTION_CLASS}>{subtitle}</SheetDescription>
              ) : null}
              <SheetTitle className={cn(ADMIN_DIALOG_TITLE_CLASS, "font-heading text-h4")}>
                {title}
              </SheetTitle>
              {description ? (
                <p className={ADMIN_DIALOG_DESCRIPTION_CLASS}>{description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerAside}
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              <X className="size-3.5" />
              Close
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
