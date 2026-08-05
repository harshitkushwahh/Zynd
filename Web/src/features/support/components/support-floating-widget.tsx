"use client";

import { Headset, X } from "lucide-react";

import { SupportChatPopover } from "@/features/support/components/support-chat-popover";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

export function SupportFloatingWidget() {
  const { viewMode, isOpen, togglePopover, close } = useSupportWidget();

  const fabOpen = viewMode === "popover";
  const label = fabOpen ? copy.support.closeTooltip : copy.support.openTooltip;

  return (
    <>
      <SupportChatPopover />

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
          "zynd-support-fab group fixed z-50 flex h-14 cursor-pointer items-center overflow-hidden rounded-full shadow-zynd-high outline-none",
          "bottom-[4.75rem] right-3 md:bottom-6 md:right-6",
          "w-14 transition-[width,padding,background-color,transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:w-[12.75rem] hover:pr-5 focus-visible:w-[12.75rem] focus-visible:pr-5",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          fabOpen
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "zynd-support-fab-gradient text-primary-foreground",
          isOpen && viewMode === "popover" && "scale-95",
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
          )}
        >
          {label}
        </span>
      </button>
    </>
  );
}
