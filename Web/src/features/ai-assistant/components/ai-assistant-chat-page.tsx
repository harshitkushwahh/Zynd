"use client";

import Link from "next/link";
import {
  AlertCircle,
  PanelLeftClose,
  PenLine,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { ZyndAiSimpleIcon } from "@/components/dashboard/zynd-ai-bot-icon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getDisplayName } from "@/lib/auth-api";
import { greetingNameFromDisplayName } from "@/shared/utils/user-display";
import { cn } from "@/lib/utils";
import { AI_ASSISTANT_DRAFT_PREFILL_KEY } from "@/features/ai-assistant/lib/ai-navbar-nudge";
import { copy } from "@/shared/config/copy";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  body: string;
};

type ChatThread = {
  id: string;
  title: string;
  monthLabel: string;
  messages: ChatMessage[];
};

function createId(prefix = "ai-msg") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyThread(): ChatThread {
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date());
  return {
    id: createId("thread"),
    title: copy.aiAssistant.newChat,
    monthLabel,
    messages: [],
  };
}

function buildSeedThreads(): ChatThread[] {
  return copy.aiAssistant.seedThreads.map((seed, index) => ({
    id: seed.id,
    title: seed.title,
    monthLabel: seed.monthLabel,
    messages:
      index <= 1
        ? [
            { id: `${seed.id}-u1`, role: "user", body: seed.title },
            { id: `${seed.id}-a1`, role: "assistant", body: copy.aiAssistant.dummyReply },
          ]
        : [],
  }));
}

function groupThreadsByMonth(threads: ChatThread[]): { label: string; threads: ChatThread[] }[] {
  const order: string[] = [];
  const map = new Map<string, ChatThread[]>();
  for (const thread of threads) {
    if (!map.has(thread.monthLabel)) {
      map.set(thread.monthLabel, []);
      order.push(thread.monthLabel);
    }
    map.get(thread.monthLabel)!.push(thread);
  }
  return order.map((label) => ({ label, threads: map.get(label)! }));
}

function threadHasConversation(thread: ChatThread): boolean {
  return thread.messages.some((message) => message.role === "user");
}

function UserBubble({ body }: { body: string }) {
  return (
    <div className="ai-assistant-message-enter flex justify-end">
      <div className="max-w-[min(85%,22rem)] rounded-[1.25rem] rounded-br-md bg-muted/90 px-4 py-2.5 text-[15px] leading-snug text-foreground shadow-sm ring-1 ring-border/40">
        {body}
      </div>
    </div>
  );
}

function AssistantBubble({ body }: { body: string }) {
  return (
    <div className="ai-assistant-message-enter flex gap-2.5">
      <ZyndAiSimpleIcon size="sm" className="shrink-0 self-end" />
      <div className="max-w-[min(100%,28rem)] rounded-[1.25rem] rounded-bl-md border border-border/60 bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground shadow-zynd-low">
        {body}
      </div>
    </div>
  );
}

function PreviewNotice() {
  return (
    <div className="ai-assistant-message-enter flex w-full items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertCircle className="size-4 shrink-0 self-center" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{copy.aiAssistant.previewNoticeTitle}</p>
        <p className="text-[13px] opacity-90">
          {copy.aiAssistant.previewNoticeBody}{" "}
          <Link href="/dashboard/help" className="font-medium underline underline-offset-2">
            {copy.aiAssistant.supportLinkLabel}
          </Link>
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 self-center text-amber-950 dark:text-amber-100"
        disabled
      >
        <RotateCcw className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}

const AI_COMPOSER_FOOTER_MIN_HEIGHT_PX = 108;
const AI_COMPOSER_FOOTER_MAX_HEIGHT_PX = 168;
const AI_COMPOSER_HERO_MIN_HEIGHT_PX = 176;
const AI_COMPOSER_HERO_MAX_HEIGHT_PX = 240;

function ComposerDisclaimer() {
  return (
    <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
      {copy.aiAssistant.disclaimerLead}{" "}
      <Link
        href={copy.aiAssistant.disclaimerVerifyHref}
        className="border-b border-dashed border-muted-foreground/45 text-muted-foreground underline-offset-2 transition-colors hover:border-muted-foreground/70 hover:text-foreground"
      >
        {copy.aiAssistant.disclaimerVerifyLabel}
      </Link>
    </p>
  );
}

function ComposerField({
  draft,
  onDraftChange,
  onKeyDown,
  placeholder,
  variant = "footer",
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  variant?: "hero" | "footer";
}) {
  const isHero = variant === "hero";
  const minHeightPx = isHero ? AI_COMPOSER_HERO_MIN_HEIGHT_PX : AI_COMPOSER_FOOTER_MIN_HEIGHT_PX;
  const maxHeightPx = isHero ? AI_COMPOSER_HERO_MAX_HEIGHT_PX : AI_COMPOSER_FOOTER_MAX_HEIGHT_PX;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeightPx), maxHeightPx);
    textarea.style.height = `${nextHeight}px`;
  }, [maxHeightPx, minHeightPx]);

  useEffect(() => {
    syncTextareaHeight();
  }, [draft, syncTextareaHeight]);

  return (
    <div
      className={cn(
        "ai-assistant-composer relative shrink-0 border border-border/75 bg-background",
        isHero && "ai-assistant-composer--hero",
      )}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="block w-full resize-none overflow-y-auto border-0 bg-transparent px-5 pb-12 pt-5 pr-14 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        style={{
          minHeight: minHeightPx,
          maxHeight: maxHeightPx,
        }}
        aria-label={copy.aiAssistant.composerAriaLabel}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="ai-assistant-composer-send absolute bottom-3 right-3 size-9 rounded-full border border-border/80 bg-background text-muted-foreground shadow-none hover:bg-muted/30 disabled:opacity-45"
        disabled={!draft.trim()}
        aria-label={copy.aiAssistant.sendLabel}
      >
        <Send className="size-[1.05rem] stroke-[1.75]" />
      </Button>
    </div>
  );
}

function SidebarCircleButton({
  label,
  active,
  onClick,
  children,
  title,
}: {
  label?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "ai-assistant-thread-chip flex size-11 flex-col items-center justify-center rounded-full border border-border/70 bg-background text-[10px] font-semibold text-muted-foreground shadow-sm",
        active && "ai-assistant-thread-chip--active border-primary/40 text-foreground",
      )}
    >
      {children}
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

export function AiAssistantChatPage() {
  const { user } = useAuth();
  const [boot] = useState(() => {
    const empty = createEmptyThread();
    return { threads: [empty, ...buildSeedThreads()] as ChatThread[], activeId: empty.id };
  });
  const [threads, setThreads] = useState<ChatThread[]>(boot.threads);
  const [activeThreadId, setActiveThreadId] = useState(boot.activeId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [showPreviewNotice, setShowPreviewNotice] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem(AI_ASSISTANT_DRAFT_PREFILL_KEY);
      if (!prefill?.trim()) return;
      sessionStorage.removeItem(AI_ASSISTANT_DRAFT_PREFILL_KEY);
      setDraft(prefill.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [activeThreadId, threads],
  );

  const messages = activeThread?.messages ?? [];
  const showHero = !threadHasConversation(activeThread!) && !showPreviewNotice;
  const groupedHistory = useMemo(() => groupThreadsByMonth(threads), [threads]);
  const displayName = user ? getDisplayName(user) : "Investor";
  const greetingName = greetingNameFromDisplayName(displayName);

  const scrollToBottom = useCallback(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setShowPreviewNotice(false);
    setDraft("");
  }, []);

  const updateActiveThread = useCallback(
    (updater: (thread: ChatThread) => ChatThread) => {
      setThreads((current) =>
        current.map((thread) => (thread.id === activeThreadId ? updater(thread) : thread)),
      );
    },
    [activeThreadId],
  );

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !activeThread) return;

    updateActiveThread((thread) => {
      const nextTitle =
        !threadHasConversation(thread) ? text.slice(0, 48) || thread.title : thread.title;
      return {
        ...thread,
        title: nextTitle,
        messages: [
          ...thread.messages,
          { id: createId(), role: "user", body: text },
          { id: createId(), role: "assistant", body: copy.aiAssistant.dummyReply },
        ],
      };
    });
    setDraft("");
    setShowPreviewNotice(true);
    requestAnimationFrame(scrollToBottom);
  }, [activeThread, draft, scrollToBottom, updateActiveThread]);

  const startNewChat = useCallback(() => {
    const thread = createEmptyThread();
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setShowPreviewNotice(false);
    setDraft("");
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const expandSidebar = () => setSidebarCollapsed(false);
  const collapseSidebar = () => setSidebarCollapsed(true);

  return (
    <div className="ai-assistant-page-enter flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-zynd-low",
          "h-[calc(100dvh-9.5rem)] min-h-[28rem] md:h-[calc(100dvh-8.25rem)]",
        )}
      >
        <aside
          className={cn(
            "ai-assistant-sidebar relative hidden h-full min-h-0 shrink-0 overflow-hidden border-r border-border/70 bg-muted/25 md:block",
            sidebarCollapsed ? "w-[4.5rem]" : "w-[13.5rem]",
          )}
        >
          <div
            className={cn(
              "ai-assistant-sidebar-rail absolute inset-y-0 left-0 z-10 flex w-[4.5rem] flex-col items-center gap-2 px-2 py-3",
              !sidebarCollapsed && "ai-assistant-sidebar-rail--hidden",
            )}
          >
            <button
              type="button"
              title={copy.aiAssistant.expandSidebar}
              onClick={expandSidebar}
              className="rounded-xl p-0.5 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ZyndAiSimpleIcon size="sm" />
            </button>

            <SidebarCircleButton title={copy.aiAssistant.newChat} onClick={startNewChat}>
              <PenLine className="size-4 text-foreground" />
            </SidebarCircleButton>

            <div className="my-1 h-px w-8 bg-border/80" aria-hidden />

            {threads.slice(0, 4).map((thread, index) => {
              const label = copy.aiAssistant.collapsedChatLabel(index + 1);
              return (
                <SidebarCircleButton
                  key={thread.id}
                  title={thread.title}
                  label={label}
                  active={thread.id === activeThreadId}
                  onClick={() => selectThread(thread.id)}
                >
                  <span className="text-[11px] font-bold tracking-tight text-foreground">{label}</span>
                </SidebarCircleButton>
              );
            })}
          </div>

          <div
            className={cn(
              "ai-assistant-sidebar-panel flex min-h-full flex-col",
              sidebarCollapsed && "ai-assistant-sidebar-panel--hidden",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
              <button
                type="button"
                className="shrink-0 rounded-xl transition-transform hover:scale-105"
                onClick={collapseSidebar}
                aria-label={copy.aiAssistant.collapseSidebar}
              >
                <ZyndAiSimpleIcon size="sm" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
                {copy.aiAssistant.productName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                onClick={collapseSidebar}
                aria-label={copy.aiAssistant.collapseSidebar}
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>

            <div className="p-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 rounded-xl border-border/80 bg-background shadow-none"
                onClick={startNewChat}
              >
                <PenLine className="size-4 shrink-0" />
                {copy.aiAssistant.newChat}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
              {groupedHistory.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">{copy.aiAssistant.historyEmpty}</p>
              ) : (
                groupedHistory.map(({ label, threads: monthThreads }) => (
                  <div key={label} className="mb-4">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <ul className="space-y-0.5">
                      {monthThreads.map((thread) => {
                        const chipLabel = copy.aiAssistant.collapsedChatLabel(
                          threads.indexOf(thread) + 1,
                        );
                        return (
                          <li key={thread.id}>
                            <button
                              type="button"
                              onClick={() => selectThread(thread.id)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug transition-colors",
                                thread.id === activeThreadId
                                  ? "bg-background font-medium text-foreground shadow-sm"
                                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                              )}
                            >
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold leading-none">
                                {chipLabel}
                              </span>
                              <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{thread.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5 md:hidden">
            <div className="flex items-center gap-2">
              <ZyndAiSimpleIcon size="sm" />
              <span className="text-sm font-semibold">{copy.aiAssistant.productName}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={startNewChat}
            >
              <PenLine className="size-3.5" />
              {copy.aiAssistant.newChat}
            </Button>
          </div>

          {showHero ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 md:px-10">
              <div className="flex w-full max-w-2xl flex-col items-center text-center">
                <ZyndAiSimpleIcon size="lg" className="mb-6" />
                <p className="text-base text-muted-foreground">
                  {copy.aiAssistant.heroGreeting(greetingName)}
                </p>
                <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {copy.aiAssistant.heroTagline}
                </h1>
                <form onSubmit={onSubmit} className="mt-10 w-full">
                  <ComposerField
                    draft={draft}
                    onDraftChange={setDraft}
                    onKeyDown={onComposerKeyDown}
                    placeholder={copy.aiAssistant.composerPlaceholder}
                    variant="hero"
                  />
                  <ComposerDisclaimer />
                </form>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-8 md:px-8"
                role="log"
                aria-live="polite"
                aria-label={copy.aiAssistant.messagesAriaLabel}
              >
                <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <UserBubble key={message.id} body={message.body} />
                    ) : (
                      <AssistantBubble key={message.id} body={message.body} />
                    ),
                  )}
                  {showPreviewNotice ? <PreviewNotice /> : null}
                </div>
              </div>

              <div className="shrink-0 bg-background px-4 pb-5 pt-2 md:px-8">
                <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl">
                  <ComposerField
                    draft={draft}
                    onDraftChange={setDraft}
                    onKeyDown={onComposerKeyDown}
                    placeholder={copy.aiAssistant.composerPlaceholder}
                  />
                  <ComposerDisclaimer />
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
