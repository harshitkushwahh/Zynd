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
  SupportUpdateCard,
} from "@/features/support/components/support-help-cards";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import {
  SUPPORT_PLATFORM_UPDATES,
  SUPPORT_RECENT_TICKETS,
} from "@/features/support/lib/support-dummy-data";
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
  const { helpTab, setHelpTab, openChat, close } = useSupportWidget();

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
            {helpTab === "home" ? (
              <HomeTabContent onOpenChat={openChat} />
            ) : (
              <UpdatesTabContent />
            )}
          </div>

          <div className="shrink-0 border-t border-border/80 bg-background px-3 py-2.5">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/55 p-1">
              <TabButton
                active={helpTab === "home"}
                icon={Ticket}
                label={copy.support.homeTab}
                onClick={() => setHelpTab("home")}
              />
              <TabButton
                active={helpTab === "updates"}
                icon={Bell}
                label={copy.support.updatesTab}
                onClick={() => setHelpTab("updates")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeTabContent({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h3 className="text-body font-semibold text-foreground">
          {copy.support.recentTicketsTitle}
        </h3>
        <Button type="button" variant="muted" size="sm" onClick={onOpenChat}>
          {copy.support.seeAllTickets}
        </Button>
      </div>

      {SUPPORT_RECENT_TICKETS.length === 0 ? (
        <p className="py-8 text-center text-caption text-muted-foreground">
          {copy.support.noRecentTickets}
        </p>
      ) : (
        <div className="space-y-2">
          {SUPPORT_RECENT_TICKETS.map((ticket) => (
            <SupportTicketCard key={ticket.id} ticket={ticket} onSelect={onOpenChat} />
          ))}
        </div>
      )}

      <Button
        type="button"
        className="h-11 w-full gap-2 rounded-2xl shadow-zynd-low"
        onClick={onOpenChat}
      >
        <MessageCircle className="size-4" />
        {copy.support.startChat}
      </Button>
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

function TabButton({
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
        "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-zynd-low"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} />
      {label}
    </button>
  );
}
