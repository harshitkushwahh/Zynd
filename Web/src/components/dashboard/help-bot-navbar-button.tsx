"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getHelpBotStatus, isHelpBotLlmConnected } from "@/features/support/lib/support-api";
import { useSupportWidgetOptional } from "@/features/support/contexts/support-widget-context";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const POLL_MS = 45_000;

type HelpBotConnection = "loading" | "connected" | "unavailable";

export function HelpBotNavbarButton() {
  const router = useRouter();
  const support = useSupportWidgetOptional();
  const [connection, setConnection] = useState<HelpBotConnection>("loading");

  const refresh = useCallback(() => {
    void getHelpBotStatus()
      .then((payload) => {
        setConnection(isHelpBotLlmConnected(payload) ? "connected" : "unavailable");
      })
      .catch(() => {
        setConnection("unavailable");
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const tooltip =
    connection === "connected"
      ? copy.navbar.helpBotOnline
      : connection === "unavailable"
        ? copy.navbar.helpBotOffline
        : copy.navbar.helpBotChecking;

  const handleClick = () => {
    router.push("/dashboard/help");
    support?.openMessageSupport();
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "zynd-ai-bot-button",
              connection === "unavailable" && "zynd-ai-bot-button--offline opacity-80",
            )}
            aria-label={copy.navbar.aiBotLabel}
            onClick={handleClick}
          >
            <span className="zynd-ai-bot-aurora" aria-hidden />
            <span className="zynd-ai-bot-surface">
              <span className="zynd-ai-bot-fold" aria-hidden />
              <span className="zynd-ai-bot-points" aria-hidden>
                {Array.from({ length: 10 }, (_, index) => (
                  <i key={index} className="zynd-ai-bot-point" />
                ))}
              </span>
              <span className="zynd-ai-bot-inner">
                <Bot className="zynd-ai-bot-icon" strokeWidth={2.5} />
              </span>
            </span>
            {connection === "connected" ? (
              <span className="zynd-ai-bot-status" aria-hidden />
            ) : null}
          </button>
        }
      />
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
