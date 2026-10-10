"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

type SupportTicketIdCopyBadgeProps = {
  ticketId: string;
  className?: string;
};

export function SupportTicketIdCopyBadge({ ticketId, className }: SupportTicketIdCopyBadgeProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ticketId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [ticketId]);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-caption text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        className,
      )}
      onClick={() => void onCopy()}
      aria-label={copied ? "Ticket ID copied" : `Copy ticket ID ${ticketId}`}
    >
      <Ticket className="size-3.5 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
      <span>{ticketId}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-success" strokeWidth={2.25} aria-hidden />
      ) : (
        <Copy className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
