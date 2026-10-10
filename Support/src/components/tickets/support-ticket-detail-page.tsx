"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { SupportTicketDetailAside } from "@/components/tickets/support-ticket-detail-aside";
import { SupportTicketDetailHeader } from "@/components/tickets/support-ticket-detail-header";
import { SupportTicketDetailMainPanel } from "@/components/tickets/support-ticket-detail-main-panel";
import { SupportTicketDetailSectionTabs } from "@/components/tickets/support-ticket-detail-section-tabs";
import type { SupportTicketDetailTabId } from "@/components/tickets/support-ticket-detail-tab-ids";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { SUPPORT_TICKET_DETAIL_WORKSPACE_HEIGHT_CLASS } from "@/lib/support-layout";
import {
  fetchSupportTicketDetail,
  isSupportTicketNotFoundError,
} from "@/lib/support-tickets-api";
import type { SupportTicketDetail } from "@/lib/support-types";
import { cn } from "@/lib/utils";

type SupportTicketDetailPageProps = {
  ticketId: string;
};

export function SupportTicketDetailPage({ ticketId }: SupportTicketDetailPageProps) {
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [activeTab, setActiveTab] = useState<SupportTicketDetailTabId>("conversation");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "error">(
    "loading",
  );

  useEffect(() => {
    setLoadState("loading");
    setDetail(null);
    setActiveTab("conversation");

    let cancelled = false;
    void fetchSupportTicketDetail(ticketId)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isSupportTicketNotFoundError(error)) {
          setLoadState("not_found");
          return;
        }
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loadState === "loading") {
    return (
      <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
        <div className="space-y-3 pb-3">
          <div className="h-7 w-32 animate-pulse rounded-full bg-muted" aria-hidden />
          <div className="h-8 w-2/3 max-w-md animate-pulse rounded-md bg-muted" aria-hidden />
        </div>
        <div
          className={cn(
            SUPPORT_TICKET_DETAIL_WORKSPACE_HEIGHT_CLASS,
            "grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]",
          )}
        >
          <div className="flex min-h-0 flex-col gap-3">
            <div className="h-10 w-72 max-w-full animate-pulse rounded-full bg-muted" aria-hidden />
            <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-muted" aria-hidden />
          </div>
          <div className="hidden min-h-0 animate-pulse rounded-lg bg-muted lg:block" aria-hidden />
        </div>
      </div>
    );
  }

  if (loadState === "not_found") {
    notFound();
  }

  if (loadState === "error" || !detail) {
    return (
      <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
        <p className="text-body text-muted-foreground">Could not load this ticket. Try again later.</p>
      </div>
    );
  }

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <SupportTicketDetailHeader detail={detail} />

      <div
        className={cn(
          SUPPORT_TICKET_DETAIL_WORKSPACE_HEIGHT_CLASS,
          "grid min-h-0 w-full gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch",
        )}
      >
        <div className="flex min-h-0 flex-col items-start gap-3">
          <SupportTicketDetailSectionTabs value={activeTab} onChange={setActiveTab} />
          <div className="flex min-h-0 w-full flex-1 flex-col self-stretch">
            <SupportTicketDetailMainPanel
              detail={detail}
              activeTab={activeTab}
              className="h-full min-h-0"
            />
          </div>
        </div>
        <SupportTicketDetailAside detail={detail} className="min-h-0 lg:max-h-full" />
      </div>
    </div>
  );
}
