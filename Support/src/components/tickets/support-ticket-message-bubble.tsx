"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatSupportTicketMessageTime } from "@/lib/support-ticket-display";
import type { SupportTicketMessage } from "@/lib/support-types";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { cn } from "@/lib/utils";

type SupportTicketMessageBubbleProps = {
  message: SupportTicketMessage;
  agentInitials: string;
  investorInitials: string;
};

export function SupportTicketMessageBubble({
  message,
  agentInitials,
  investorInitials,
}: SupportTicketMessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center px-2 py-1.5">
        <p className="max-w-[min(28rem,92%)] rounded-full border border-border/60 bg-background/80 px-3.5 py-1.5 text-center text-[11px] leading-relaxed text-muted-foreground shadow-zynd-low">
          {message.body}
        </p>
      </div>
    );
  }

  const isAgent = message.role === "agent";
  const senderLabel = message.senderName ?? "Support";
  const initials = isAgent
    ? agentInitials
    : getDisplayInitials(message.senderName ?? "Investor");

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isAgent ? "justify-end" : "justify-start",
      )}
    >
      {!isAgent ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
          <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "flex w-full max-w-[min(100%,42rem)] flex-col gap-1 sm:max-w-[min(100%,52rem)] xl:max-w-[72%]",
          isAgent ? "items-end" : "items-start",
        )}
      >
        <span className="px-1 text-[11px] font-medium text-muted-foreground">{senderLabel}</span>
        <div
          className={cn(
            "overflow-hidden rounded-2xl px-3.5 py-2.5 text-compact leading-relaxed shadow-zynd-low",
            isAgent
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border/70 bg-card text-foreground",
          )}
        >
          <p>{message.body}</p>
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatSupportTicketMessageTime(message.createdAt)}
        </span>
      </div>

      {isAgent ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}
