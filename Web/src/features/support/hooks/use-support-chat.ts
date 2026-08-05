"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getDummyAgentReply,
  SUPPORT_AGENT,
  SUPPORT_INITIAL_MESSAGES,
  SUPPORT_QUICK_REPLIES,
} from "@/features/support/lib/support-dummy-data";
import { createSupportMessageId } from "@/features/support/lib/support-format";
import type {
  SupportImageAttachment,
  SupportMessage,
} from "@/features/support/lib/support-types";
import { copy } from "@/shared/config/copy";

const AGENT_REPLY_DELAY_MS = 900;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function useSupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>(SUPPORT_INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<SupportImageAttachment | null>(null);
  const [agentTyping, setAgentTyping] = useState(false);
  const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      if (replyTimeoutRef.current) {
        clearTimeout(replyTimeoutRef.current);
      }
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const scheduleAgentReply = useCallback((userText: string, hasImage: boolean) => {
    if (replyTimeoutRef.current) {
      clearTimeout(replyTimeoutRef.current);
    }

    setAgentTyping(true);
    replyTimeoutRef.current = setTimeout(() => {
      const body = hasImage
        ? copy.support.imageReceivedReply
        : getDummyAgentReply(userText);

      setMessages((current) => [
        ...current,
        {
          id: createSupportMessageId(),
          role: "agent",
          senderName: SUPPORT_AGENT.name,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setAgentTyping(false);
      replyTimeoutRef.current = null;
    }, AGENT_REPLY_DELAY_MS);
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
        objectUrlsRef.current.delete(current.url);
      }
      return null;
    });
  }, []);

  const attachImage = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      return;
    }

    setAttachment((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
        objectUrlsRef.current.delete(current.url);
      }

      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return {
        id: createSupportMessageId(),
        url,
        name: file.name,
        file,
      };
    });
  }, []);

  const sendMessage = useCallback(
    (rawText: string, image?: SupportImageAttachment | null) => {
      const body = rawText.trim();
      const activeImage = image ?? attachment;
      if ((!body && !activeImage) || agentTyping) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: createSupportMessageId(),
          role: "user",
          body: body || (activeImage ? copy.support.imageOnlyCaption : ""),
          createdAt: new Date().toISOString(),
          imageUrl: activeImage?.url,
          imageName: activeImage?.name,
        },
      ]);
      setDraft("");
      if (activeImage) {
        // Keep object URL alive for the message bubble; drop draft attachment only.
        objectUrlsRef.current.add(activeImage.url);
        setAttachment(null);
      }
      scheduleAgentReply(body || copy.support.imageOnlyCaption, Boolean(activeImage));
    },
    [agentTyping, attachment, scheduleAgentReply],
  );

  const sendDraft = useCallback(() => {
    sendMessage(draft, attachment);
  }, [attachment, draft, sendMessage]);

  const sendQuickReply = useCallback(
    (message: string) => {
      sendMessage(message, null);
    },
    [sendMessage],
  );

  return {
    agent: SUPPORT_AGENT,
    quickReplies: SUPPORT_QUICK_REPLIES,
    messages,
    draft,
    setDraft,
    attachment,
    attachImage,
    clearAttachment,
    agentTyping,
    sendDraft,
    sendQuickReply,
  };
}
