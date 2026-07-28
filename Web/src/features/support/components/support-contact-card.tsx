"use client";

import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SupportChatPanel } from "@/features/support/components/support-chat-panel";
import { SupportHelpCenter } from "@/features/support/components/support-help-center";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type SupportContactCardProps = {
  className?: string;
  variant?: "popover" | "fullscreen";
};

const headerIconButtonClass =
  "size-8 rounded-[0.65rem] bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground";

export function SupportContactCard({
  className,
  variant = "popover",
}: SupportContactCardProps) {
  const {
    panelView,
    expandToFullscreen,
    collapseToPopover,
    backToHelp,
    close,
  } = useSupportWidget();

  const secondaryAction =
    variant === "popover" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={headerIconButtonClass}
        aria-label={copy.support.expandAriaLabel}
        onClick={expandToFullscreen}
      >
        <Maximize2 className="size-3.5" />
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={headerIconButtonClass}
        aria-label={copy.support.collapseAriaLabel}
        onClick={collapseToPopover}
      >
        <Minimize2 className="size-3.5" />
      </Button>
    );

  if (panelView === "chat") {
    return (
      <SupportChatPanel
        className={className}
        messagesClassName={
          variant === "fullscreen"
            ? "px-4 sm:px-6 md:mx-auto md:w-full md:max-w-3xl"
            : undefined
        }
        headerActions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={headerIconButtonClass}
              aria-label={copy.support.backToHelp}
              onClick={backToHelp}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            {secondaryAction}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={headerIconButtonClass}
              aria-label={copy.support.closeAriaLabel}
              onClick={close}
            >
              <X className="size-3.5" />
            </Button>
          </>
        }
      />
    );
  }

  return (
    <SupportHelpCenter className={cn(className)} headerActions={secondaryAction} />
  );
}
