"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PAGE_HEADER_ICON_CLASS } from "@/components/ui/page-header";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

export const NAVBAR_PAGE_HOVER_CARD_SIDE_OFFSET = 12;

export const NAVBAR_PAGE_HOVER_CARD_CLASS = cn(
  ZYND_3XL_RADIUS_CLASS,
  "w-72 border border-border/80 bg-card p-4 shadow-zynd-high",
);

type NavbarPageHoverCardBodyProps = {
  title: string;
  description: string;
  leading?: ReactNode;
};

export function NavbarPageHoverCardBody({
  title,
  description,
  leading,
}: NavbarPageHoverCardBodyProps) {
  return (
    <div className="flex items-start gap-3">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-compact font-semibold text-foreground">{title}</p>
        <p className="text-caption leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function NavbarPageHoverIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon className={cn("size-5 pt-0.5", PAGE_HEADER_ICON_CLASS)} strokeWidth={2.25} aria-hidden />
  );
}
