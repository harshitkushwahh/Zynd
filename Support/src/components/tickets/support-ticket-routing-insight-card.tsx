"use client";

import { Brain, Users } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SupportTicketRoutingInsight } from "@/lib/support-types";
import { cn } from "@/lib/utils";

type SupportTicketRoutingInsightCardProps = {
  routing: SupportTicketRoutingInsight | null | undefined;
  className?: string;
};

export function SupportTicketRoutingInsightCard({
  routing,
  className,
}: SupportTicketRoutingInsightCardProps) {
  if (!routing?.reasonSummary && routing?.urgencyScore == null) {
    return null;
  }

  const pm = routing.pmCoHandling;
  const sourceLabel = routing.source === "ai" ? "AI routing" : "Analytics fallback";

  return (
    <section
      className={cn(
        "rounded-lg border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Brain className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-caption font-semibold text-foreground">Support intelligence</h3>
            {routing.urgencyScore != null ? (
              <StatusBadge variant="info" showIcon={false}>
                Urgency {routing.urgencyScore}
              </StatusBadge>
            ) : null}
            <StatusBadge variant="neutral" showIcon={false} className="capitalize">
              {sourceLabel}
            </StatusBadge>
          </div>
          {routing.reasonSummary ? (
            <p className="text-[12px] leading-snug text-muted-foreground">{routing.reasonSummary}</p>
          ) : null}
          {routing.signals.length > 0 ? (
            <ul className="list-inside list-disc text-[11px] text-muted-foreground">
              {routing.signals.slice(0, 4).map((signal) => (
                <li key={signal}>{signal.replace(/_/g, " ")}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {pm?.mitraDisplayName ? (
        <div className="mt-3 flex gap-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-2.5">
          <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 text-[11px] leading-snug text-muted-foreground">
            <p className="font-medium text-foreground">
              PM co-handling · {pm.recommendedAction ?? "notify"}
            </p>
            <p>
              {pm.mitraDisplayName}
              {pm.mitraClientId ? ` · ${pm.mitraClientId}` : ""}
            </p>
            {pm.reason ? <p className="mt-1">{pm.reason}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
