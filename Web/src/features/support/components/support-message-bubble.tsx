"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useProfileImageOptional } from "@/contexts/profile-image-context";
import { useSupportWidget } from "@/features/support/contexts/support-widget-context";
import { formatSupportMessageTime } from "@/features/support/lib/support-format";
import type { SupportMessage } from "@/features/support/lib/support-types";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";
import { getUserInitials } from "@/shared/utils/user-display";

type SupportMessageBubbleProps = {
  message: SupportMessage;
};

export function SupportMessageBubble({ message }: SupportMessageBubbleProps) {
  const { user } = useAuth();
  const profileImage = useProfileImageOptional();
  const { chat } = useSupportWidget();

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
  const hasImage = Boolean(message.imageUrl);
  const showText =
    Boolean(message.body) &&
    !(hasImage && message.body === copy.support.imageOnlyCaption);

  const userInitials = getUserInitials(user?.first_name, user?.email);
  const profileLabel = user?.first_name?.trim() || user?.email || "You";

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {chat.agent.initials}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "flex w-full max-w-[min(100%,42rem)] flex-col gap-1 sm:max-w-[min(100%,52rem)] xl:max-w-[72%]",
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
            "overflow-hidden rounded-2xl text-compact leading-relaxed",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground shadow-zynd-low"
              : "rounded-bl-md border border-border/70 bg-card text-foreground shadow-zynd-low",
            hasImage && !showText ? "p-1.5" : "px-3.5 py-2.5",
            hasImage && showText && "p-1.5",
          )}
        >
          {message.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img
              src={message.imageUrl}
              alt={message.imageName || "Uploaded image"}
              className={cn(
                "max-h-52 w-full max-w-[16rem] rounded-xl object-cover",
                showText && "mb-2",
              )}
            />
          ) : null}
          {showText ? (
            <p className={cn(hasImage && "px-2 pb-1.5 pt-0.5")}>{message.body}</p>
          ) : null}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatSupportMessageTime(message.createdAt)}
        </span>
      </div>

      {isUser ? (
        <Avatar size="sm" className="mb-5 shrink-0 border border-border/70">
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
