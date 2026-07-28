"use client";

import { SupportContactCard } from "@/features/support/components/support-contact-card";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type SupportChatPopoverProps = {
  className?: string;
};

export function SupportChatPopover({ className }: SupportChatPopoverProps) {
  const { viewMode, close } = useSupportWidget();

  if (viewMode !== "popover") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label={copy.support.closeAriaLabel}
        className="fixed inset-0 z-40 bg-transparent"
        onClick={close}
      />
      <div
        role="dialog"
        aria-label={copy.support.helpCenterLabel}
        className={cn(
          "fixed z-50 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.35rem] border border-border bg-popover text-popover-foreground shadow-zynd-high ring-1 ring-foreground/10",
          "bottom-[5.5rem] right-3 origin-bottom-right animate-in fade-in-0 zoom-in-95 duration-200",
          "md:bottom-24 md:right-6",
          "h-[min(36rem,calc(100dvh-8rem))]",
          className,
        )}
      >
        <SupportContactCard variant="popover" className="h-full min-h-0" />
      </div>
    </>
  );
}
