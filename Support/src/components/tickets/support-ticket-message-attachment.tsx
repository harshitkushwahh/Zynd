import { FileText } from "lucide-react";

import type { SupportTicketAttachment } from "@/lib/support-types";

export function SupportTicketMessageAttachment({ attachment }: { attachment: SupportTicketAttachment }) {
  return (
    <div className="mt-2 flex max-w-[16rem] items-center gap-2 rounded-[var(--radius-control)] border border-border/70 bg-background px-2.5 py-2 shadow-zynd-low">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <FileText className="size-4" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-caption font-medium text-foreground">{attachment.fileName}</p>
        <p className="text-micro text-muted-foreground">PDF · Attachment</p>
      </div>
    </div>
  );
}
