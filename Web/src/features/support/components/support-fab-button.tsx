"use client";

import { Headset, X } from "lucide-react";

import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type SupportFabButtonProps = {
  className?: string;
};

export function SupportFabButton({ className }: SupportFabButtonProps) {
  const { viewMode, isOpen, togglePopover, close } = useSupportWidget();
  const fabOpen = viewMode === "popover";
  const label = fabOpen ? copy.support.closeTooltip : copy.support.openTooltip;

  return (
    <button
      type="button"
      aria-label={fabOpen ? copy.support.closeAriaLabel : copy.support.openAriaLabel}
      aria-expanded={fabOpen}
      onClick={() => {
        if (fabOpen) {
          close();
          return;
        }
        togglePopover();
      }}
      className={cn(
        "zynd-support-fab group flex h-14 shrink-0 cursor-pointer items-center overflow-hidden rounded-full shadow-zynd-high outline-none",
        "w-14 transition-[width,padding,background-color,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:w-[12.75rem] hover:pr-5 focus-visible:w-[12.75rem] focus-visible:pr-5",
        "[body[data-mf-screener-drag]_&]:hover:w-14 [body[data-mf-screener-drag]_&]:hover:pr-0",
        "[body[data-mf-screener-drag]_&]:focus-visible:w-14 [body[data-mf-screener-drag]_&]:focus-visible:pr-0",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        fabOpen
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        isOpen && viewMode === "popover" && "scale-95",
        className,
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center">
        {fabOpen ? (
          <X className="size-5" strokeWidth={2.25} />
        ) : (
          <Headset className="zynd-support-fab-icon size-5" strokeWidth={2.1} />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 overflow-hidden text-compact font-semibold whitespace-nowrap opacity-0",
          "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover:opacity-100 group-focus-visible:opacity-100",
          "[body[data-mf-screener-drag]_&]:group-hover:opacity-0 [body[data-mf-screener-drag]_&]:group-focus-visible:opacity-0",
        )}
      >
        {label}
      </span>
    </button>
  );
}
