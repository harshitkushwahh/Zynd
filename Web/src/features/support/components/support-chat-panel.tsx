"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SupportChatComposer } from "@/features/support/components/support-chat-composer";
import { SupportMessageBubble } from "@/features/support/components/support-message-bubble";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const NEAR_BOTTOM_PX = 72;

type SupportChatPanelProps = {
  headerActions?: ReactNode;
  className?: string;
  messagesClassName?: string;
  showQuickReplies?: boolean;
  showHeader?: boolean;
  /** brand = popover gradient bar; page = agent window header */
  headerVariant?: "brand" | "page";
};

export function SupportChatPanel({
  headerActions,
  className,
  messagesClassName,
  showQuickReplies = true,
  showHeader = true,
  headerVariant = "brand",
}: SupportChatPanelProps) {
  const { chat } = useSupportWidget();
  const {
    agent,
    quickReplies,
    messages,
    draft,
    setDraft,
    attachment,
    attachImage,
    clearAttachment,
    agentTyping,
    sendDraft,
    sendQuickReply,
  } = chat;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const distanceFromBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    stickToBottomRef.current = true;
    setShowScrollDown(false);
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior,
    });
  }, []);

  const handleMessagesScroll = useCallback(
    (_event: UIEvent<HTMLDivElement>) => {
      updateScrollState();
    },
    [updateScrollState],
  );

  useEffect(() => {
    if (!stickToBottomRef.current) {
      updateScrollState();
      return;
    }
    scrollToBottom("smooth");
  }, [messages, agentTyping, scrollToBottom, updateScrollState]);

  const handleSendDraft = useCallback(() => {
    stickToBottomRef.current = true;
    sendDraft();
  }, [sendDraft]);

  const handleQuickReply = useCallback(
    (message: string) => {
      stickToBottomRef.current = true;
      sendQuickReply(message);
    },
    [sendQuickReply],
  );

  const showSuggestions =
    showQuickReplies &&
    !agentTyping &&
    messages.filter((message) => message.role === "user").length <= 2;

  const isPageHeader = headerVariant === "page";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}>
      {showHeader ? (
        isPageHeader ? (
          <div className="shrink-0 border-b border-border/70">
            <div className="flex w-full items-center justify-between gap-3 px-1 py-3">
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar size="lg" className="border border-border/80 shadow-zynd-low">
                    <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
                      {agent.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background",
                      agent.status === "online" ? "bg-emerald-500" : "bg-amber-400",
                    )}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-foreground">
                    {copy.support.title}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                    <span className="truncate">{agent.name}</span>
                    <span aria-hidden>·</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        agent.status === "online" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          agent.status === "online" ? "bg-emerald-500" : "bg-amber-400",
                        )}
                      />
                      {agent.status === "online" ? copy.support.agentOnline : copy.support.agentAway}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {showSuggestions ? (
                  <div
                    className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    aria-label={copy.support.quickRepliesHint}
                  >
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        type="button"
                        onClick={() => handleQuickReply(reply.message)}
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-foreground shadow-zynd-low",
                          "transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                          "active:scale-[0.98]",
                        )}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {headerActions ? (
                  <div className="flex shrink-0 items-center gap-1">{headerActions}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-gradient-brand px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <Avatar size="lg" className="border border-primary-foreground/25">
                  <AvatarFallback className="bg-primary-foreground/15 text-caption font-semibold text-primary-foreground">
                    {agent.initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-[color-mix(in_oklch,var(--primary),black_12%)]",
                    agent.status === "online" ? "bg-emerald-400" : "bg-amber-400",
                  )}
                  aria-hidden
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-primary-foreground">
                  {copy.support.title}
                </p>
                <p className="truncate text-caption text-primary-foreground/85">
                  {agent.name} · {agent.statusLabel}
                </p>
              </div>
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-1">{headerActions}</div>
            ) : null}
          </div>
        )
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={handleMessagesScroll}
          className={cn(
            "h-full space-y-3.5 overflow-y-auto px-3 py-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
            isPageHeader && "bg-muted/20",
            messagesClassName,
          )}
        >
          {messages.map((message) => (
            <SupportMessageBubble key={message.id} message={message} />
          ))}

          {agentTyping ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2.5">
                <Avatar size="sm" className="border border-border/70">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {agent.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-bl-md border border-border/70 bg-card px-3.5 py-3 shadow-zynd-low">
                  <div className="flex items-center gap-1" aria-label={copy.support.typingLabel}>
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {showScrollDown ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={copy.support.scrollDownAriaLabel}
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 left-1/2 z-10 size-9 -translate-x-1/2 rounded-full border border-border bg-background/95 shadow-zynd-mid backdrop-blur-[var(--blur-sm)]"
          >
            <ChevronDown className="size-4" />
          </Button>
        ) : null}
      </div>

      {!isPageHeader && showSuggestions ? (
        <div className="shrink-0 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-[var(--blur-sm)]">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {quickReplies.map((reply) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => handleQuickReply(reply.message)}
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-card px-3 py-1.5 text-caption font-medium whitespace-nowrap text-foreground shadow-zynd-low",
                  "transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                  "active:scale-[0.98]",
                )}
              >
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <SupportChatComposer
        value={draft}
        onChange={setDraft}
        onSend={handleSendDraft}
        attachment={attachment}
        onAttachImage={attachImage}
        onClearAttachment={clearAttachment}
        disabled={agentTyping}
        className={cn(
          isPageHeader &&
            // Clear the fixed support FAB (size-14 + right offset) so send isn't covered
            "border-border/70 bg-background px-1 py-3 pr-20 md:pr-24",
        )}
      />
    </div>
  );
}
