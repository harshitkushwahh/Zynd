"use client";

import {
  Bell,
  MessageCircle,
  Ticket,
} from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { useAuth } from "@/contexts/auth-context";
import { SupportChatPanel } from "@/features/support/components/support-chat-panel";
import {
  SupportTicketCard,
  SupportTicketsEmptyState,
  SupportUpdateCard,
} from "@/features/support/components/support-help-cards";
import { SupportTicketsLoadMore } from "@/features/support/components/support-tickets-load-more";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { useMySupportTickets } from "@/features/support/hooks/use-my-support-tickets";
import { SUPPORT_PLATFORM_UPDATES } from "@/features/support/lib/support-dummy-data";
import { getSupportGreeting } from "@/features/support/lib/support-greeting";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

export function SupportHelpPage() {
  const { user } = useAuth();
  const {
    panelView,
    helpTab,
    setHelpTab,
    openChat,
    backToHelp,
    chat,
  } = useSupportWidget();
  const { tickets, ticketsLoaded, hasMore, loadingMore, loadMore } = useMySupportTickets();

  const hasTickets = tickets.length > 0;
  const helpHomeBootstrapping = !chat.conversationReady && panelView === "help";

  if (panelView === "chat") {
    return (
      <div className="flex h-[calc(100dvh-11.5rem)] min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-8.5rem)]">
        <DashboardBreadcrumb
          className="shrink-0"
          items={[
            { label: copy.support.helpCenterLabel, onClick: backToHelp },
            { label: copy.support.title },
          ]}
        />
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] border-2 bg-card shadow-zynd-low",
            !chat.canReply
              ? "border-success/40 ring-1 ring-success/15"
              : "border-border",
          )}
        >
          <SupportChatPanel
            className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-xl)] bg-card"
            showHeader
            headerVariant="page"
            showQuickReplies={false}
            messagesClassName="px-4 w-full md:px-5"
          />
        </div>
      </div>
    );
  }

  if (helpHomeBootstrapping) {
    return (
      <div className="flex min-h-0 flex-col gap-5">
        <DashboardBreadcrumb items={[{ label: copy.support.helpCenterLabel }]} />
        <div
          className="h-[min(24rem,calc(100dvh-14rem))] animate-pulse rounded-[var(--radius-xl)] border-2 border-border bg-muted/30"
          aria-busy="true"
          aria-label={copy.support.helpCenterLabel}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <DashboardBreadcrumb items={[{ label: copy.support.helpCenterLabel }]} />

      <div className="flex min-h-0 flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <PageTitle className="truncate">
              {getSupportGreeting(user?.first_name)}
            </PageTitle>
            <p className="mt-1.5 text-body text-muted-foreground">
              {copy.support.helpSubtitle}
            </p>
          </div>

          {hasTickets || !ticketsLoaded ? (
            <Button type="button" className="gap-2" onClick={openChat}>
              <MessageCircle className="size-4" />
              {copy.support.startChat}
            </Button>
          ) : null}
        </div>

        <HelpPageTabBar
          helpTab={helpTab}
          onHome={() => setHelpTab("home")}
          onUpdates={() => setHelpTab("updates")}
        />

        <section
          role="tabpanel"
          id="support-help-page-tab-home"
          aria-labelledby="support-help-page-tab-btn-home"
          hidden={helpTab !== "home"}
          className={cn("space-y-4", helpTab !== "home" && "hidden")}
        >
          {!ticketsLoaded ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              <div className="h-36 animate-pulse rounded-[var(--radius-xl)] bg-muted/50 sm:col-span-2 xl:col-span-3" />
            </div>
          ) : hasTickets ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tickets.map((ticket) => (
                  <SupportTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onSelect={() => {
                      void chat.openTicket(ticket.id).then(() => openChat()).catch(() => undefined);
                    }}
                    className="h-full"
                  />
                ))}
              </div>
              <SupportTicketsLoadMore
                hasMore={hasMore}
                loading={loadingMore}
                onLoadMore={loadMore}
                className="flex justify-center pt-1"
              />
            </>
          ) : (
            <SupportTicketsEmptyState
              onStartChat={() => {
                chat.startNewChat();
                openChat();
              }}
            />
          )}
        </section>

        <section
          role="tabpanel"
          id="support-help-page-tab-updates"
          aria-labelledby="support-help-page-tab-btn-updates"
          hidden={helpTab !== "updates"}
          className={cn("space-y-4", helpTab !== "updates" && "hidden")}
        >
          <h2 className="text-body font-semibold text-foreground">{copy.support.updatesTitle}</h2>

          {SUPPORT_PLATFORM_UPDATES.length === 0 ? (
            <p className="rounded-[var(--radius-xl)] border border-dashed border-border/80 px-4 py-12 text-center text-caption text-muted-foreground">
              {copy.support.noUpdates}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SUPPORT_PLATFORM_UPDATES.map((update) => (
                <SupportUpdateCard
                  key={update.id}
                  update={update}
                  variant="page"
                  className="h-full"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HelpPageTabBar({
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
      className="relative grid w-fit grid-cols-2 gap-1 rounded-[var(--radius-full)] bg-tab-track p-1"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-[var(--radius-full)] bg-background shadow-zynd-low",
          "transition-transform duration-200 ease-out will-change-transform",
          isUpdates && "translate-x-[calc(100%+4px)]",
        )}
      />
      <HelpPageTabButton
        id="support-help-page-tab-btn-home"
        active={!isUpdates}
        icon={Ticket}
        label={copy.support.homeTab}
        onClick={onHome}
      />
      <HelpPageTabButton
        id="support-help-page-tab-btn-updates"
        active={isUpdates}
        icon={Bell}
        label={copy.support.updatesTab}
        onClick={onUpdates}
      />
    </div>
  );
}

function HelpPageTabButton({
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
        "relative z-10 inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded-[var(--radius-full)] px-3 py-1.5 text-caption font-medium",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
      {label}
    </button>
  );
}
