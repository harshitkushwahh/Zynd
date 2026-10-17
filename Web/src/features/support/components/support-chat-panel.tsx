"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { ChevronDown, Lock } from "lucide-react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SupportChatComposer } from "@/features/support/components/support-chat-composer";
import { SupportMessageBubble } from "@/features/support/components/support-message-bubble";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const NEAR_BOTTOM_PX = 72;

function SupportPresenceDot({
  online,
  className,
  size = "md",
}: {
  online: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const dot = size === "sm" ? "size-1.5" : "size-2.5";
  const ping = size === "sm" ? "size-1.5" : "size-2.5";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        dot,
        className,
      )}
    >
      {online ? (
        <span
          className={cn(
            "motion-safe:animate-pulse absolute inset-0 rounded-full bg-emerald-500/50",
            ping,
          )}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "relative rounded-full",
          dot,
          online ? "bg-emerald-500" : "bg-amber-400",
        )}
      />
    </span>
  );
}

function SupportAvatarPresenceBadge({
  online,
  ringClassName,
}: {
  online: boolean;
  ringClassName: string;
}) {
  return (
    <AvatarBadge
      aria-hidden
      className={cn(
        "size-2.5 min-h-0 min-w-0 border-0 p-0",
        online ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-amber-400",
        ringClassName,
      )}
    />
  );
}

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
    chatHeader,
    quickReplies,
    messages,
    attachment,
    attachImage,
    clearAttachment,
    agentTyping,
    canReply,
    sendMessage,
    sendQuickReply,
    startNewChat,
  } = chat;

  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [chat.threadKey]);

  const header = chatHeader ?? agent;
  const showPresence = Boolean(header.showPresence);

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
    sendMessage(draft, attachment);
    setDraft("");
  }, [attachment, draft, sendMessage]);

  const handleQuickReply = useCallback(
    (message: string) => {
      stickToBottomRef.current = true;
      sendQuickReply(message);
    },
    [sendQuickReply],
  );

  const showSuggestions =
    canReply &&
    showQuickReplies &&
    !agentTyping &&
    messages.filter((message) => message.role === "user").length <= 2;

  const isPageHeader = headerVariant === "page";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-background",
        isPageHeader && "overflow-hidden rounded-[inherit]",
        !canReply && isPageHeader && "bg-muted/10",
        className,
      )}
    >
      {showHeader ? (
        isPageHeader ? (
          <div className="shrink-0 border-b border-border/70">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5 md:px-5">
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar size="lg" className="border border-border/80 shadow-zynd-low">
                    <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
                      {header.initials}
                    </AvatarFallback>
                    {showPresence ? (
                      <SupportAvatarPresenceBadge
                        online={header.status === "online"}
                        ringClassName="ring-background"
                      />
                    ) : null}
                  </Avatar>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-foreground">
                    {copy.support.title}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                    <span className="truncate">{header.name}</span>
                    {showPresence ? (
                      <>
                        <span aria-hidden>·</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            header.status === "online"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          <SupportPresenceDot
                            online={header.status === "online"}
                            size="sm"
                          />
                          {header.status === "online"
                            ? copy.support.agentOnline
                            : copy.support.agentAway}
                        </span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{header.statusLabel}</span>
                      </>
                    )}
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
                    {header.initials}
                  </AvatarFallback>
                  {showPresence ? (
                    <SupportAvatarPresenceBadge
                      online={header.status === "online"}
                      ringClassName="ring-[color-mix(in_oklch,var(--primary),black_12%)]"
                    />
                  ) : null}
                </Avatar>
              </div>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-primary-foreground">
                  {copy.support.title}
                </p>
                <p className="truncate text-caption text-primary-foreground/85">
                  {header.name} · {showPresence ? (header.status === "online" ? copy.support.agentOnline : copy.support.agentAway) : header.statusLabel}
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

      {canReply ? (
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
              "rounded-b-[var(--radius-xl)] border-t border-border/70 bg-background px-3 py-3 md:px-5",
          )}
        />
      ) : (
        <div
          className={cn(
            "shrink-0 border-t border-border/70 bg-muted/25 px-3 py-3",
            isPageHeader && "px-4 md:px-5",
          )}
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
            <div
              className="flex min-h-11 flex-1 items-center gap-2.5 rounded-[var(--radius-control)] border border-border/70 bg-background/60 px-3 py-2.5"
              aria-disabled="true"
            >
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-caption leading-snug text-muted-foreground">
                {copy.support.ticketResolvedComposerLocked}
              </p>
            </div>
            <Button type="button" size="sm" className="h-11 shrink-0 px-4" onClick={startNewChat}>
              {copy.support.startChat}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
