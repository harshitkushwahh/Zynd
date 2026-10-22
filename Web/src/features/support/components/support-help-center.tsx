"use client";

import type { ReactNode } from "react";
import {
  Bell,
  MessageCircle,
  Ticket,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  SupportTicketCard,
  SupportTicketsEmptyState,
  SupportUpdateCard,
} from "@/features/support/components/support-help-cards";
import { SupportTicketsLoadMore } from "@/features/support/components/support-tickets-load-more";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { useMySupportTickets } from "@/features/support/hooks/use-my-support-tickets";
import { SUPPORT_PLATFORM_UPDATES } from "@/features/support/lib/support-dummy-data";
import {
  getSupportGreeting,
} from "@/features/support/lib/support-greeting";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type SupportHelpCenterProps = {
  headerActions?: ReactNode;
  className?: string;
};

export function SupportHelpCenter({ headerActions, className }: SupportHelpCenterProps) {
  const { user } = useAuth();
  const { helpTab, setHelpTab, openChat, openMessageSupport, close, chat } = useSupportWidget();

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gradient-brand", className)}>
      {/* Help Center label — always above the sheet */}
      <div className="relative z-30 shrink-0 px-5 pt-5 pb-2">
        <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/80 uppercase">
            {copy.support.helpCenterLabel}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-[0.65rem] bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              aria-label={copy.support.closeAriaLabel}
              onClick={close}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Greeting stays put; sheet max-height is the space below Help Center */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 px-5 pt-1 pb-16">
          <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative">
            <h2 className="truncate font-heading text-[1.65rem] font-semibold tracking-tight text-primary-foreground">
              {getSupportGreeting(user?.first_name)}
            </h2>
            <p className="mt-1.5 text-body text-primary-foreground/88">
              {copy.support.helpSubtitle}
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[5.25rem] bottom-0 z-10 flex flex-col overflow-hidden rounded-t-[1.35rem] border border-border/70 bg-background shadow-[0_-10px_28px_rgba(15,23,42,0.12)] dark:shadow-[0_-10px_28px_rgba(0,0,0,0.35)]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3.5 pt-4 pb-5 [scrollbar-width:thin]">
            <div
              role="tabpanel"
              id="support-help-tab-home"
              aria-labelledby="support-help-tab-btn-home"
              hidden={helpTab !== "home"}
              className={helpTab === "home" ? undefined : "hidden"}
            >
              <HomeTabContent
                onOpenChat={openMessageSupport}
                onOpenTicket={(ticketId) => {
                  void chat.openTicket(ticketId).then(() => openChat()).catch(() => undefined);
                }}
              />
            </div>
            <div
              role="tabpanel"
              id="support-help-tab-updates"
              aria-labelledby="support-help-tab-btn-updates"
              hidden={helpTab !== "updates"}
              className={helpTab === "updates" ? undefined : "hidden"}
            >
              <UpdatesTabContent />
            </div>
          </div>

          <div className="shrink-0 border-t border-border/80 bg-background px-3 py-2.5">
            <HelpCenterTabBar helpTab={helpTab} onHome={() => setHelpTab("home")} onUpdates={() => setHelpTab("updates")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeTabContent({
  onOpenChat,
  onOpenTicket,
}: {
  onOpenChat: () => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const { chat } = useSupportWidget();
  const { tickets, ticketsLoaded, hasMore, loadingMore, loadMore } = useMySupportTickets();

  const hasTickets = tickets.length > 0;

  return (
    <div className="space-y-3.5">
      {!ticketsLoaded ? (
        <div className="space-y-2 px-0.5" aria-busy="true" aria-label={copy.support.recentTicketsTitle}>
          <div className="h-5 w-28 animate-pulse rounded-md bg-muted/80" />
          <div className="h-[5.5rem] animate-pulse rounded-[1rem] bg-muted/50" />
        </div>
      ) : hasTickets ? (
        <>
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <SupportTicketCard
                key={ticket.id}
                ticket={ticket}
                onSelect={() => onOpenTicket(ticket.id)}
              />
            ))}
          </div>
          <SupportTicketsLoadMore
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={loadMore}
            className="px-0.5"
          />
          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-2xl shadow-zynd-low"
            onClick={onOpenChat}
          >
            <MessageCircle className="size-4" />
            {copy.support.startChat}
          </Button>
        </>
      ) : (
        <SupportTicketsEmptyState
          compact
          onStartChat={() => {
            chat.startNewChat();
            onOpenChat();
          }}
        />
      )}
    </div>
  );
}

function UpdatesTabContent() {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h3 className="text-body font-semibold text-foreground">{copy.support.updatesTitle}</h3>
      </div>

      {SUPPORT_PLATFORM_UPDATES.length === 0 ? (
        <p className="py-8 text-center text-caption text-muted-foreground">
          {copy.support.noUpdates}
        </p>
      ) : (
        <div className="space-y-2">
          {SUPPORT_PLATFORM_UPDATES.map((update) => (
            <SupportUpdateCard key={update.id} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}

function HelpCenterTabBar({
  helpTab,
  onHome,
  onUpdates,
}: {
  helpTab: "home" | "updates";
  onHome: () => void;
  onUpdates: () => void;
}) {
  const isUpdates = helpTab === "updates";

  return (
    <div
      role="tablist"
      aria-label={copy.support.helpCenterLabel}
      className="relative grid grid-cols-2 gap-1 rounded-2xl bg-muted/55 p-1"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-xl bg-primary shadow-zynd-low",
          "transition-transform duration-200 ease-out will-change-transform",
          isUpdates && "translate-x-[calc(100%+4px)]",
        )}
      />
      <HelpCenterTabButton
        id="support-help-tab-btn-home"
        active={!isUpdates}
        icon={Ticket}
        label={copy.support.homeTab}
        onClick={onHome}
      />
      <HelpCenterTabButton
        id="support-help-tab-btn-updates"
        active={isUpdates}
        icon={Bell}
        label={copy.support.updatesTab}
        onClick={onUpdates}
      />
    </div>
  );
}

function HelpCenterTabButton({
  id,
  active,
  icon: Icon,
  label,
  onClick,
}: {
  id: string;
  active: boolean;
  icon: typeof Ticket;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        "relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
        active ? "text-primary-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} />
      {label}
    </button>
  );
}
