"use client";

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Megaphone,
  Sparkles,
  Zap,
} from "lucide-react";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  formatSupportCardDate,
} from "@/features/support/lib/support-greeting";
import type {
  SupportPlatformUpdate,
  SupportRecentTicket,
  SupportUpdateTone,
} from "@/features/support/lib/support-types";
import { cn } from "@/lib/utils";

function supportTicketStatusVariant(status: SupportRecentTicket["status"]): StatusBadgeVariant {
  if (status === "resolved") return "success";
  if (status === "pending") return "warning";
  return "info";
}

function supportTicketStatusIcon(status: SupportRecentTicket["status"]) {
  if (status === "resolved") return CheckCircle2;
  if (status === "pending") return Clock3;
  return CircleDot;
}

function supportUpdateStatusVariant(tone: SupportUpdateTone = "update"): StatusBadgeVariant {
  if (tone === "new") return "success";
  if (tone === "improvement") return "info";
  return "neutral";
}

export function SupportTicketCard({
  ticket,
  onSelect,
  className,
}: {
  ticket: SupportRecentTicket;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-[1rem] border border-border/70 bg-card px-3.5 py-3 text-left transition-all hover:border-primary/25 hover:bg-muted/25 hover:shadow-zynd-low",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge
          variant={supportTicketStatusVariant(ticket.status)}
          icon={supportTicketStatusIcon(ticket.status)}
          className="rounded-full"
        >
          {ticket.statusLabel}
        </StatusBadge>
        <span className="text-[11px] text-muted-foreground">
          {formatSupportCardDate(ticket.updatedAt)}
        </span>
      </div>
      <p className="mt-2.5 text-compact font-semibold text-foreground">
        {ticket.title}
      </p>
      <p className="mt-1 line-clamp-2 text-caption leading-relaxed text-muted-foreground">
        {ticket.description}
      </p>
    </button>
  );
}

function updateToneStyles(tone: SupportUpdateTone = "update") {
  if (tone === "new") {
    return {
      Icon: Sparkles,
      iconWrap: "bg-success/12 text-success",
      accent: "from-success/20 via-success/5 to-transparent",
    };
  }
  if (tone === "improvement") {
    return {
      Icon: Zap,
      iconWrap: "bg-info/12 text-info",
      accent: "from-info/20 via-info/5 to-transparent",
    };
  }
  return {
    Icon: Megaphone,
    iconWrap: "bg-muted text-muted-foreground",
    accent: "from-muted via-muted/40 to-transparent",
  };
}

export function SupportUpdateCard({
  update,
  className,
  variant = "compact",
}: {
  update: SupportPlatformUpdate;
  className?: string;
  variant?: "compact" | "page";
}) {
  const tone = updateToneStyles(update.tone);
  const Icon = tone.Icon;
  const isPage = variant === "page";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.15rem] border border-border/70 bg-card transition-all",
        "hover:border-primary/20 hover:shadow-zynd-mid",
        isPage ? "px-4 py-4 sm:px-5 sm:py-5" : "px-3.5 py-3 shadow-zynd-low",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-80",
          tone.accent,
        )}
      />

      <div className={cn("relative flex", isPage ? "gap-3.5" : "gap-3")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            isPage ? "size-11" : "size-9",
            tone.iconWrap,
          )}
        >
          <Icon className={cn(isPage ? "size-5" : "size-4")} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge
              variant={supportUpdateStatusVariant(update.tone)}
              icon={tone.Icon}
              className="rounded-full"
            >
              {update.badge}
            </StatusBadge>
            <time
              dateTime={update.publishedAt}
              className="text-[11px] text-muted-foreground"
            >
              {formatSupportCardDate(update.publishedAt)}
            </time>
          </div>

          <h3
            className={cn(
              "mt-2 font-semibold tracking-tight text-foreground",
              isPage ? "text-body" : "text-compact",
            )}
          >
            {update.title}
          </h3>
          <p
            className={cn(
              "mt-1 leading-relaxed text-muted-foreground",
              isPage ? "text-caption sm:text-compact" : "line-clamp-2 text-caption",
            )}
          >
            {update.description}
          </p>
        </div>
      </div>
    </article>
  );
}
