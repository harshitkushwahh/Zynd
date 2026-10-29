"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useProfileImageOptional } from "@/contexts/profile-image-context";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { fetchSupportAttachment } from "@/features/support/lib/support-api";
import { isResolutionPromptMessage } from "@/features/support/lib/support-resolution";
import { formatSupportMessageTime } from "@/features/support/lib/support-format";
import { SupportReadReceipt } from "@/features/support/components/support-read-receipt";
import type { SupportMessage } from "@/features/support/lib/support-types";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";
import { getUserInitials } from "@/shared/utils/user-display";

type SupportMessageBubbleProps = {
  message: SupportMessage;
};

function StoredAttachmentImage({
  supportMessageId,
  hasStoredAttachment,
  name,
  previewUrl,
}: {
  supportMessageId: string;
  hasStoredAttachment: boolean;
  name?: string;
  previewUrl?: string;
}) {
  const [src, setSrc] = useState(previewUrl ?? "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (previewUrl || !hasStoredAttachment) {
      setSrc(previewUrl ?? "");
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void fetchSupportAttachment(supportMessageId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc("");
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [hasStoredAttachment, previewUrl, supportMessageId]);

  if (!src) {
    if (failed) {
      return (
        <p className="px-2 py-1 text-caption text-muted-foreground">{copy.support.imageLoadFailed}</p>
      );
    }
    return (
      <div
        className="flex h-32 w-full min-w-[8rem] max-w-[16rem] items-center justify-center rounded-xl bg-muted/40 text-caption text-muted-foreground"
        aria-busy="true"
        aria-label={name || "Loading image"}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated ticket image
    <img
      src={src}
      alt={name || "Uploaded image"}
      className="max-h-52 w-full max-w-[16rem] rounded-xl object-cover"
    />
  );
}

function BotHelpFeedbackRow({ message }: { message: SupportMessage }) {
  const { chat } = useSupportWidget();
  const [pending, setPending] = useState<"yes" | "no" | null>(null);

  if (message.authorRole !== "bot" || message.id === "zynd-help-bot-greeting") {
    return null;
  }
  if (message.helpFeedback === "yes") {
    return (
      <p className="px-1 text-[10px] text-muted-foreground">{copy.support.helpFeedbackThanks}</p>
    );
  }
  if (message.helpFeedback === "no" || !message.helpFeedbackActive) {
    return null;
  }

  const choose = (choice: "yes" | "no") => {
    if (pending) return;
    setPending(choice);
    void chat.submitHelpFeedback(message.id, choice).finally(() => setPending(null));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5">
      <span className="text-[10px] text-muted-foreground">{copy.support.helpFeedbackPrompt}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-lg px-2.5 text-[11px]"
        disabled={pending !== null}
        onClick={() => choose("yes")}
      >
        {copy.support.helpFeedbackYes}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 rounded-lg px-2.5 text-[11px] text-muted-foreground"
        disabled={pending !== null}
        onClick={() => choose("no")}
      >
        {copy.support.helpFeedbackNo}
      </Button>
    </div>
  );
}

function ResolutionPromptCard({ message }: { message: SupportMessage }) {
  const { chat } = useSupportWidget();
  const [pending, setPending] = useState<"yes" | "no" | null>(null);
  const showButtons = chat.canReply && Boolean(message.resolutionActive);

  const choose = (choice: "yes" | "no") => {
    if (pending || !showButtons) return;
    setPending(choice);
    void chat.respondToResolution(choice).finally(() => setPending(null));
  };

  return (
    <div className="flex w-full min-w-0 max-w-full items-end gap-2 justify-start px-0.5 py-1 isolate">
      <Avatar size="sm" className="mb-5 shrink-0 border border-border/70 bg-card shadow-zynd-low after:mix-blend-normal">
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
          {chat.agent.initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 max-w-[calc(100%-2.75rem)] flex-col items-start gap-1 sm:max-w-[min(85%,24rem)]">
        <span className="px-1 text-[11px] font-medium text-muted-foreground">
          {message.senderName ?? chat.agent.name}
        </span>
        <div className="w-full min-w-0 max-w-full rounded-2xl rounded-bl-md border border-border/70 bg-card px-3.5 py-3 shadow-zynd-low">
          <p className="text-compact font-semibold break-words [overflow-wrap:anywhere] text-foreground">
            {message.body}
          </p>
          {showButtons ? (
            <>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-10 flex-1 rounded-xl"
                  disabled={pending !== null}
                  onClick={() => choose("yes")}
                >
                  {copy.support.resolutionYes}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 flex-1 rounded-xl"
                  disabled={pending !== null}
                  onClick={() => choose("no")}
                >
                  {copy.support.resolutionNo}
                </Button>
              </div>
            </>
          ) : null}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatSupportMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function SupportMessageBubble({ message }: SupportMessageBubbleProps) {
  const { user } = useAuth();
  const profileImage = useProfileImageOptional();
  const { chat } = useSupportWidget();

  if (isResolutionPromptMessage(message)) {
    return (
      <ResolutionPromptCard
        message={{
          ...message,
          kind: "resolution_prompt",
        }}
      />
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

  const isUser = message.role === "user";
  const hasStoredAttachment = Boolean(message.attachmentId);
  const hasImage = Boolean(message.imageUrl || hasStoredAttachment);
  const hideImageCaption =
    message.body === copy.support.imageOnlyCaption ||
    message.body === "I attached an image." ||
    (hasStoredAttachment && message.imageName && message.body === message.imageName);
  const showText = Boolean(message.body) && !(hasImage && hideImageCaption);

  const userInitials = getUserInitials(user?.first_name, user?.email);
  const profileLabel = user?.first_name?.trim() || user?.email || "You";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full items-end gap-2 isolate",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70 bg-card shadow-zynd-low after:mix-blend-normal">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {chat.agent.initials}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 max-w-[calc(100%-2.75rem)] flex-col gap-1 sm:max-w-[min(85%,42rem)] xl:max-w-[72%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {!isUser && message.senderName ? (
          <span className="px-1 text-[11px] font-medium text-muted-foreground">
            {message.senderName}
          </span>
        ) : null}
        <div
          className={cn(
            "w-full min-w-0 max-w-full overflow-hidden rounded-2xl text-compact leading-relaxed",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground shadow-zynd-low"
              : "rounded-bl-md border border-border/70 bg-card text-foreground shadow-zynd-low",
            hasImage && !showText ? "p-1.5" : "px-3.5 py-2.5",
            hasImage && showText && "p-1.5",
          )}
        >
          {hasImage ? (
            <div className={cn(showText && "mb-2")}>
              <StoredAttachmentImage
                supportMessageId={message.id}
                hasStoredAttachment={hasStoredAttachment}
                name={message.imageName}
                previewUrl={message.imageUrl}
              />
            </div>
          ) : null}
          {showText ? (
            <p
              className={cn(
                "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                hasImage && "px-2 pb-1.5 pt-0.5",
              )}
            >
              {message.body}
            </p>
          ) : null}
        </div>
        <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {formatSupportMessageTime(message.createdAt)}
          {isUser ? (
            <SupportReadReceipt
              outboundToSupport
              supportReadAt={message.supportReadAt}
              supportReadBy={message.supportReadBy}
              tone="outbound"
            />
          ) : (
            <SupportReadReceipt
              inboundReadByCustomer
              customerReadAt={message.customerReadAt}
              tone="inbound"
            />
          )}
        </span>
        {!isUser ? <BotHelpFeedbackRow message={message} /> : null}
      </div>

      {isUser ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70 bg-card shadow-zynd-low after:mix-blend-normal">
          {profileImage?.profileUrl ? (
            <AvatarImage src={profileImage.profileUrl} alt={profileLabel} />
          ) : null}
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}
