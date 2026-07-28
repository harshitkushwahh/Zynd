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
  SupportUpdateCard,
} from "@/features/support/components/support-help-cards";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import {
  SUPPORT_ALL_TICKETS,
  SUPPORT_PLATFORM_UPDATES,
} from "@/features/support/lib/support-dummy-data";
import {
  getSupportGreeting,
} from "@/features/support/lib/support-greeting";
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
  } = useSupportWidget();

  if (panelView === "chat") {
    return (
      <div className="-mx-1 flex h-[calc(100dvh-11.5rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100dvh-8.5rem)]">
        <DashboardBreadcrumb
          className="shrink-0 px-1"
          items={[
            { label: copy.support.helpCenterLabel, onClick: backToHelp },
            { label: copy.support.title },
          ]}
        />
        <SupportChatPanel
          className="min-h-0 flex-1 overflow-hidden bg-transparent"
          showHeader
          headerVariant="page"
          showQuickReplies
          messagesClassName="px-1 w-full"
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
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {copy.support.helpCenterLabel}
            </p>
            <PageTitle className="mt-1.5 truncate">
              {getSupportGreeting(user?.first_name)}
            </PageTitle>
            <p className="mt-1.5 text-body text-muted-foreground">
              {copy.support.helpSubtitle}
            </p>
          </div>

          <Button type="button" className="gap-2" onClick={openChat}>
            <MessageCircle className="size-4" />
            {copy.support.startChat}
          </Button>
        </div>

        <div className="inline-flex w-fit gap-1 rounded-[var(--radius-full)] bg-tab-track p-1">
          <PageTabButton
            active={helpTab === "home"}
            icon={Ticket}
            label={copy.support.homeTab}
            onClick={() => setHelpTab("home")}
          />
          <PageTabButton
            active={helpTab === "updates"}
            icon={Bell}
            label={copy.support.updatesTab}
            onClick={() => setHelpTab("updates")}
          />
        </div>

        {helpTab === "home" ? (
          <section className="space-y-4">
            <h2 className="text-body font-semibold text-foreground">
              {copy.support.allTicketsTitle}
            </h2>

            {SUPPORT_ALL_TICKETS.length === 0 ? (
              <p className="rounded-[var(--radius-xl)] border border-dashed border-border/80 px-4 py-12 text-center text-caption text-muted-foreground">
                {copy.support.noTickets}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SUPPORT_ALL_TICKETS.map((ticket) => (
                  <SupportTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onSelect={openChat}
                    className="h-full"
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-body font-semibold text-foreground">
              {copy.support.updatesTitle}
            </h2>

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
        )}
      </div>
    </div>
  );
}

function PageTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Ticket;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-full)] px-3 py-1.5 text-caption font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-zynd-low"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
      {label}
    </button>
  );
}
