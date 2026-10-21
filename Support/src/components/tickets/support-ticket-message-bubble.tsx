"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatSupportTicketMessageTime } from "@/lib/support-ticket-display";
import { fetchSupportAttachmentBlob } from "@/lib/support-tickets-api";
import type { SupportTicketMessage } from "@/lib/support-types";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { SupportReadReceipt } from "@/components/tickets/support-read-receipt";
import { cn } from "@/lib/utils";

type SupportTicketMessageBubbleProps = {
  message: SupportTicketMessage;
  agentInitials: string;
  investorInitials: string;
};

function TicketImage({ messageId, name }: { messageId: string; name: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchSupportAttachmentBlob(messageId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [messageId]);

  if (!src) {
    return <p className="text-caption">{name}</p>;
  }

  return <img src={src} alt={name} className="max-h-52 w-full max-w-[16rem] rounded-xl object-cover" />;
}

function CustomerResolutionPromptPreview({
  message,
  investorInitials,
}: {
  message: SupportTicketMessage;
  investorInitials: string;
}) {
  return (
    <div className="flex w-full items-end gap-2 justify-start">
      <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
        <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
          {investorInitials}
        </AvatarFallback>
      </Avatar>

      <div className="flex w-full max-w-[min(100%,42rem)] flex-col items-start gap-1 sm:max-w-[min(100%,52rem)] xl:max-w-[72%]">
        <span className="px-1 text-[11px] font-medium text-muted-foreground">
          Customer · Resolution question
        </span>
        <div className="max-w-sm rounded-2xl rounded-bl-md border border-dashed border-border/70 bg-muted/15 px-3.5 py-2.5 text-compact shadow-zynd-low">
          <p className="font-medium text-foreground">{message.body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The customer answers Yes or No in their Help chat.
          </p>
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatSupportTicketMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function SupportTicketMessageBubble({
  message,
  agentInitials,
  investorInitials,
}: SupportTicketMessageBubbleProps) {
  const isResolutionPrompt =
    message.kind === "resolution_prompt" || message.body.trim() === "Is this ticket resolved?";

  if (isResolutionPrompt) {
    return (
      <CustomerResolutionPromptPreview message={message} investorInitials={investorInitials} />
    );
  }

  if (message.role === "system") {
    return (
      <div className="flex justify-center px-2 py-1.5">
        <p className="max-w-[min(28rem,92%)] rounded-full border border-border/60 bg-background/80 px-3.5 py-1.5 text-center text-[11px] leading-relaxed text-muted-foreground shadow-zynd-low">
          {message.body}
        </p>
      </div>
    );
  }

  const isStaff = message.role === "agent" || message.role === "bot";
  const isInternal = message.visibility === "internal";
  const senderLabel = isInternal
    ? `${message.senderName ?? "Support"} · Internal`
    : (message.senderName ?? "Support");
  const initials =
    message.role === "bot"
      ? "ZH"
      : isStaff
        ? agentInitials
        : message.senderName
          ? getDisplayInitials(message.senderName)
          : investorInitials;

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isStaff ? "justify-end" : "justify-start",
      )}
    >
      {!isStaff ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
          <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "flex w-full max-w-[min(100%,42rem)] flex-col gap-1 sm:max-w-[min(100%,52rem)] xl:max-w-[72%]",
          isStaff ? "items-end" : "items-start",
        )}
      >
        <span className="px-1 text-[11px] font-medium text-muted-foreground">{senderLabel}</span>
        <div
          className={cn(
            "overflow-hidden rounded-2xl px-3.5 py-2.5 text-compact leading-relaxed shadow-zynd-low",
            isInternal
              ? "rounded-br-md border border-dashed border-border bg-muted text-foreground"
              : isStaff
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md border border-border/70 bg-card text-foreground",
          )}
        >
          <p>{message.body}</p>
          {message.attachmentFileName ? (
            <div className="mt-2">
              <TicketImage messageId={message.id} name={message.attachmentFileName} />
            </div>
          ) : null}
        </div>
        <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {formatSupportTicketMessageTime(message.createdAt)}
          {isStaff && !isInternal ? (
            <SupportReadReceipt
              outboundToCustomer
              customerReadAt={message.customerReadAt}
              tone="staff"
            />
          ) : null}
          {!isStaff ? (
            <SupportReadReceipt
              inboundFromCustomer
              supportReadAt={message.supportReadAt}
              supportReadBy={message.supportReadBy}
              tone="customer"
            />
          ) : null}
        </span>
      </div>

      {isStaff ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}
