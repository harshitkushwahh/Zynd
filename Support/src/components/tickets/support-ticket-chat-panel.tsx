"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SupportTicketChatComposer } from "@/components/tickets/support-ticket-chat-composer";
import { SupportTicketMessageAttachment } from "@/components/tickets/support-ticket-message-attachment";
import { SupportTicketMessageBubble } from "@/components/tickets/support-ticket-message-bubble";
import { useSupportAuth } from "@/contexts/support-auth-context";
import { formatDistributorDate } from "@/lib/format";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { replyToSupportTicket } from "@/lib/support-tickets-api";
import type { SupportTicket, SupportTicketDetail, SupportTicketMessage } from "@/lib/support-types";
import { cn } from "@/lib/utils";

function createMessageId(): string {
  return `msg-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type SupportTicketChatPanelProps = {
  ticket: SupportTicket;
  className?: string;
  onUpdated?: (detail: SupportTicketDetail) => void;
  notifyTyping?: (typing: boolean) => void;
};

function messageDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

export function SupportTicketChatPanel({
  ticket,
  className,
  onUpdated,
  notifyTyping,
}: SupportTicketChatPanelProps) {
  const { displayName } = useSupportAuth();
  const [messages, setMessages] = useState<SupportTicketMessage[]>(ticket.messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const agentName = ticket.assigneeName ?? displayName ?? "Support Agent";
  const agentDisplayLabel = `${agentName} (You)`;
  const agentInitials = getDisplayInitials(agentName);
  const investorInitials = getDisplayInitials(
    ticket.messages.find((message) => message.role === "user")?.senderName ?? ticket.userId,
  );

  useEffect(() => {
    setMessages(ticket.messages);
  }, [ticket.messages]);

  useEffect(() => {
    setDraft("");
  }, [ticket.id]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  const handleSend = useCallback((mode: "reply" | "internal") => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");
    void replyToSupportTicket(ticket.id, body, mode === "internal" ? "internal" : "customer")
      .then((detail) => {
        setMessages(detail.ticket.messages);
        onUpdated?.(detail);
      })
      .catch(() => {
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "system",
            body: "That reply was not saved. Try again.",
            createdAt: new Date().toISOString(),
          },
        ]);
        setDraft(body);
      })
      .finally(() => {
        setSending(false);
      });
  }, [draft, onUpdated, sending, ticket.id]);

  const handleAskResolved = useCallback(() => {
    if (sending) return;
    setSending(true);
    void replyToSupportTicket(ticket.id, "", "customer", true)
      .then((detail) => {
        setMessages(detail.ticket.messages);
        onUpdated?.(detail);
      })
      .catch(() => {
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "system",
            body: "The resolution question was not sent. Try again.",
            createdAt: new Date().toISOString(),
          },
        ]);
      })
      .finally(() => {
        setSending(false);
      });
  }, [onUpdated, sending, ticket.id]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-card",
        className,
      )}
    >
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
      >
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDaySeparator =
            !previous || messageDayKey(previous.createdAt) !== messageDayKey(message.createdAt);
          const isFirstUserMessage =
            message.role === "user" &&
            !messages.slice(0, index).some((row) => row.role === "user");

          return (
            <div key={message.id} className="space-y-3">
              {showDaySeparator ? (
                <div className="flex justify-center py-1">
                  <span className="rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {formatDistributorDate(message.createdAt)}
                  </span>
                </div>
              ) : null}
              <div
                className={cn(
                  message.role === "user" && isFirstUserMessage && ticket.attachments.length > 0
                    ? "space-y-0"
                    : undefined,
                )}
              >
                <SupportTicketMessageBubble
                  message={{
                    ...message,
                    senderName:
                      message.role === "agent" && message.id.startsWith("msg-local-")
                        ? agentDisplayLabel
                        : message.senderName,
                  }}
                  agentInitials={agentInitials}
                  investorInitials={investorInitials}
                />
                {message.role === "user" && isFirstUserMessage && !message.attachmentFileName
                  ? ticket.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className={cn(
                          "flex w-full max-w-[min(100%,42rem)] pl-10 sm:max-w-[min(100%,52rem)] xl:max-w-[72%]",
                        )}
                      >
                        <SupportTicketMessageAttachment attachment={attachment} />
                      </div>
                    ))
                  : null}
              </div>
            </div>
          );
        })}
      </div>

      <SupportTicketChatComposer
        value={draft}
        onChange={(value) => {
          setDraft(value);
          if (!notifyTyping) return;
          notifyTyping(true);
          if (typingTimerRef.current) {
            window.clearTimeout(typingTimerRef.current);
          }
          typingTimerRef.current = window.setTimeout(() => {
            notifyTyping(false);
          }, 1200);
        }}
        onSend={handleSend}
        onAskResolved={handleAskResolved}
        disabled={sending}
      />
    </div>
  );
}
