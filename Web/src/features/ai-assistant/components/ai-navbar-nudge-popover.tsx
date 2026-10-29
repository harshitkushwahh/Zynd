"use client";

import { ArrowUpRight, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ZyndAiBotGraphic } from "@/components/dashboard/zynd-ai-bot-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resolveAiNavbarNudge } from "@/features/ai-assistant/lib/ai-navbar-nudge";
import { navigateToZyndAi } from "@/features/ai-assistant/lib/zynd-ai-navigation";
import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

import "@/features/ai-assistant/ai-navbar-nudge.css";

const HOVER_CLOSE_DELAY_MS = 220;

type AiNavbarNudgeCardProps = {
  headline: string;
  onOpenChat: () => void;
};

function AiNavbarNudgeCard({ headline, onOpenChat }: AiNavbarNudgeCardProps) {
  const nudgeCopy = copy.navbar.aiNudge;

  return (
    <button
      type="button"
      className="ai-navbar-nudge-card"
      aria-label={`${nudgeCopy.openChatLabel}: ${headline}`}
      onClick={onOpenChat}
    >
      <span className="ai-navbar-nudge-card__header">
        <span className="ai-navbar-nudge-card__author">
          <span className="ai-navbar-nudge-card__avatar" aria-hidden>
            <Bot className="size-4" strokeWidth={2.25} />
          </span>
          <span className="ai-navbar-nudge-card__name">{nudgeCopy.title}</span>
        </span>
        <span className="ai-navbar-nudge-card__open" aria-hidden>
          <ArrowUpRight className="size-4" strokeWidth={2.25} />
        </span>
      </span>

      <span className="ai-navbar-nudge-card__headline">{headline}</span>
    </button>
  );
}

/** Navbar AI bot with hover nudge card (dummy suggestions, no backend). */
export function AiNavbarNudgePopover() {
  const router = useRouter();
  const { pathname } = useDashboardRoute();
  const nudge = useMemo(() => resolveAiNavbarNudge(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        handleOpen();
        return;
      }
      scheduleClose();
    },
    [handleOpen, scheduleClose],
  );

  const openChat = useCallback(() => {
    setOpen(false);
    clearCloseTimer();
    window.requestAnimationFrame(() => {
      navigateToZyndAi(router);
    });
  }, [clearCloseTimer, router]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            className={cn("zynd-ai-bot-button")}
            aria-label={copy.navbar.aiBotLabel}
            onClick={() => openChat()}
            onMouseEnter={handleOpen}
            onMouseLeave={scheduleClose}
            onFocus={handleOpen}
            onBlur={scheduleClose}
          />
        }
      >
        <ZyndAiBotGraphic />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        initialFocus={false}
        finalFocus={false}
        className="ai-navbar-nudge-popover w-[min(21.5rem,calc(100vw-1.5rem))] border-0 bg-transparent p-0 shadow-none ring-0"
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
      >
        <AiNavbarNudgeCard headline={nudge.headline} onOpenChat={openChat} />
      </PopoverContent>
    </Popover>
  );
}
