"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  beginNewSupportConversation,
  getCurrentSupportConversation,
  getSupportTicketThread,
  isSupportThreadLocked,
  mapConversationMessages,
  postSupportMessage,
  respondSupportResolution,
  type SupportConversationPayload,
} from "@/features/support/lib/support-api";
import { ApiError } from "@/lib/api-client";
import { buildSupportChatHeader } from "@/features/support/lib/support-chat-participant";
import {
  connectSupportRealtime,
  subscribeSupportConversation,
  type SupportRealtimeEvent,
} from "@/features/support/lib/support-realtime";
import {
  SUPPORT_QUICK_REPLIES,
  ZYND_HELP_BOT,
  ZYND_HELP_BOT_GREETING,
} from "@/features/support/lib/support-dummy-data";
import { createSupportMessageId } from "@/features/support/lib/support-format";
import type {
  SupportImageAttachment,
  SupportMessage,
} from "@/features/support/lib/support-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const POLL_MS = 4000;

function greetingMessage(): SupportMessage {
  return {
    id: "zynd-help-bot-greeting",
    role: "agent",
    senderName: ZYND_HELP_BOT.name,
    body: ZYND_HELP_BOT_GREETING,
    createdAt: new Date().toISOString(),
  };
}

function messagesFromConversation(conversation: SupportConversationPayload): SupportMessage[] {
  if (conversation.messages.length === 0) {
    return [greetingMessage()];
  }
  return mapConversationMessages(conversation.messages, {
    resolutionOpen: Boolean(conversation.resolution_open),
  });
}

function mapRealtimeMessage(message: Record<string, unknown>): SupportMessage | null {
  const id = typeof message.id === "string" ? message.id : null;
  const body = typeof message.body === "string" ? message.body : "";
  const createdAt = typeof message.created_at === "string" ? message.created_at : null;
  if (!id || !createdAt) return null;
  const roleRaw = message.role;
  const role =
    roleRaw === "user" ? "user" : roleRaw === "system" ? "system" : "agent";
  return {
    id,
    role,
    body,
    createdAt,
    senderName: typeof message.sender_name === "string" ? message.sender_name : undefined,
    attachmentId:
      typeof message.attachment_document_id === "string"
        ? message.attachment_document_id
        : undefined,
    imageName:
      typeof message.attachment_filename === "string"
        ? message.attachment_filename
        : undefined,
  };
}

export function useSupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>([greetingMessage()]);
  const [attachment, setAttachment] = useState<SupportImageAttachment | null>(null);
  const [conversationReady, setConversationReady] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [humanAgentTyping, setHumanAgentTyping] = useState(false);
  const [handler, setHandler] = useState<"bot" | "human">("bot");
  const [canReply, setCanReply] = useState(true);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [conversationMeta, setConversationMeta] = useState<SupportConversationPayload | null>(
    null,
  );
  const [wsConnected, setWsConnected] = useState(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const sendingRef = useRef(false);
  const ticketIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const wsSendRef = useRef<(payload: object) => void>(() => undefined);

  const applyConversation = useCallback((conversation: SupportConversationPayload) => {
    ticketIdRef.current = conversation.ticket_id;
    conversationIdRef.current = conversation.id;
    setConversationMeta(conversation);
    setHandler(conversation.handler);
    const locked = isSupportThreadLocked(conversation);
    setCanReply(!locked);
    setResolutionOpen(Boolean(conversation.resolution_open) && !locked);
    setMessages(messagesFromConversation(conversation));
  }, []);

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const handleRealtimeEvent = useCallback(
    (event: SupportRealtimeEvent) => {
      if (event.type === "agent:typing") {
        if (handlerRef.current === "human") {
          setHumanAgentTyping(Boolean(event.typing));
        }
        return;
      }
      if (event.type === "message:new" && event.message) {
        const mapped = mapRealtimeMessage(event.message);
        if (!mapped) return;
        setMessages((current) => {
          if (current.some((row) => row.id === mapped.id)) return current;
          return [...current.filter((row) => row.id !== "zynd-help-bot-greeting"), mapped];
        });
        return;
      }
      if (event.type === "ticket:updated") {
        setConversationMeta((current) => {
          if (!current) return current;
          return {
            ...current,
            handler: (event.handler as SupportConversationPayload["handler"]) ?? current.handler,
            participant:
              (event.participant as SupportConversationPayload["participant"]) ??
              current.participant,
            ticket_status:
              (event.ticket_status as SupportConversationPayload["ticket_status"]) ??
              current.ticket_status,
            assignee_name: event.assignee_name ?? current.assignee_name,
            agent_presence:
              (event.agent_presence as SupportConversationPayload["agent_presence"]) ??
              current.agent_presence,
            resolution_open:
              typeof event.resolution_open === "boolean"
                ? event.resolution_open
                : current.resolution_open,
            status: event.status ?? current.status,
          };
        });
        if (event.handler === "human" || event.participant === "human") {
          setHandler("human");
        }
        return;
      }
      if (event.type === "conversation:locked") {
        setCanReply(false);
        setResolutionOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    const disconnect = connectSupportRealtime({
      onConnectionChange: setWsConnected,
      onEvent: handleRealtimeEvent,
      onReady: (send) => {
        wsSendRef.current = send;
        subscribeSupportConversation(true, send, {
          conversationId: conversationIdRef.current,
          ticketId: ticketIdRef.current,
        });
      },
    });
    return disconnect;
  }, [handleRealtimeEvent]);

  useEffect(() => {
    if (!wsConnected) return;
    subscribeSupportConversation(true, wsSendRef.current, {
      conversationId: conversationIdRef.current,
      ticketId: ticketIdRef.current,
    });
  }, [wsConnected, conversationMeta?.id, conversationMeta?.ticket_id]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    const seq = ++epochRef.current;
    let cancelled = false;
    void getCurrentSupportConversation()
      .then((conversation) => {
        if (!cancelled && epochRef.current === seq) applyConversation(conversation);
      })
      .catch(() => {
        // Keep the local greeting if the thread cannot be loaded yet.
      })
      .finally(() => {
        if (!cancelled && epochRef.current === seq) setConversationReady(true);
      });
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, [applyConversation]);

  useEffect(() => {
    if (wsConnected) return;
    if (!canReply || (!resolutionOpen && handler !== "human")) return;
    const timer = window.setInterval(() => {
      if (sendingRef.current) return;
      const seq = epochRef.current;
      const ticketId = ticketIdRef.current;
      const request = ticketId
        ? getSupportTicketThread(ticketId)
        : getCurrentSupportConversation();
      void request
        .then((conversation) => {
          if (!sendingRef.current && epochRef.current === seq) applyConversation(conversation);
        })
        .catch(() => {
          // The next poll retries.
        });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [applyConversation, canReply, handler, resolutionOpen, wsConnected]);

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
      if ((!body && !activeImage) || botTyping || sendingRef.current || !canReply) {
        return;
      }

      const caption = body || "I attached an image.";
      setMessages((current) => [
        ...current.filter((message) => message.id !== "zynd-help-bot-greeting"),
        {
          id: createSupportMessageId(),
          role: "user",
          body: caption,
          createdAt: new Date().toISOString(),
          imageUrl: activeImage?.url,
          imageName: activeImage?.name,
        },
      ]);
      if (activeImage) {
        objectUrlsRef.current.add(activeImage.url);
        setAttachment(null);
      }

      sendingRef.current = true;
      setBotTyping(handler === "bot");
      void postSupportMessage(caption, activeImage?.file)
        .then((conversation) => {
          applyConversation(conversation);
        })
        .catch((error: unknown) => {
          let body = "I couldn't send that message. Please try again in a moment.";
          if (error instanceof ApiError && error.message.trim()) {
            body = error.message;
          } else if (error instanceof Error && error.message === "support_message_timeout") {
            body =
              "The help bot is still thinking on our server. Wait a moment and refresh the chat, or try again.";
          }
          setMessages((current) => [
            ...current,
            {
              id: createSupportMessageId(),
              role: "system",
              body,
              createdAt: new Date().toISOString(),
            },
          ]);
        })
        .finally(() => {
          sendingRef.current = false;
          setBotTyping(false);
        });
    },
    [applyConversation, attachment, botTyping, canReply, handler],
  );

  const sendQuickReply = useCallback(
    (message: string) => {
      sendMessage(message, null);
    },
    [sendMessage],
  );

  const openTicket = useCallback(
    async (ticketId: string) => {
      const seq = ++epochRef.current;
      ticketIdRef.current = ticketId;
      const conversation = await getSupportTicketThread(ticketId);
      if (epochRef.current !== seq) return;
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const respondToResolution = useCallback(
    (choice: "yes" | "no") => {
      const ticketId = ticketIdRef.current;
      if (!ticketId || sendingRef.current) return Promise.resolve();
      sendingRef.current = true;
      return respondSupportResolution(ticketId, choice)
        .then((conversation) => {
          applyConversation(conversation);
        })
        .catch(() => {
          setMessages((current) => [
            ...current,
            {
              id: createSupportMessageId(),
              role: "system",
              body: "I couldn't update that ticket. Please try again.",
              createdAt: new Date().toISOString(),
            },
          ]);
        })
        .finally(() => {
          sendingRef.current = false;
        });
    },
    [applyConversation],
  );

  const startNewChat = useCallback(() => {
    epochRef.current += 1;
    const seq = epochRef.current;
    ticketIdRef.current = null;
    conversationIdRef.current = null;
    setHumanAgentTyping(false);
    setConversationReady(false);
    void beginNewSupportConversation()
      .then((conversation) => {
        if (epochRef.current !== seq) return;
        applyConversation(conversation);
      })
      .catch(() => {
        if (epochRef.current !== seq) return;
        setHandler("bot");
        setCanReply(true);
        setResolutionOpen(false);
        setConversationMeta(null);
        setMessages([greetingMessage()]);
      })
      .finally(() => {
        if (epochRef.current === seq) setConversationReady(true);
      });
  }, [applyConversation]);

  const hasEstablishedThread = useMemo(
    () =>
      Boolean(
        conversationMeta?.ticket_id ||
          (conversationMeta?.messages?.length ?? 0) > 0,
      ),
    [conversationMeta],
  );

  const chatHeader = useMemo(
    () =>
      buildSupportChatHeader(conversationMeta, {
        agentTyping: humanAgentTyping,
      }),
    [conversationMeta, humanAgentTyping],
  );

  const agentTyping = botTyping || (handler === "human" && humanAgentTyping);

  return useMemo(
    () => ({
      agent: chatHeader,
      chatHeader,
      quickReplies: SUPPORT_QUICK_REPLIES,
      messages,
      attachment,
      attachImage,
      clearAttachment,
      agentTyping,
      wsConnected,
      canReply,
      conversationReady,
      hasEstablishedThread,
      threadKey: conversationMeta?.id ?? "none",
      sendMessage,
      sendQuickReply,
      openTicket,
      respondToResolution,
      startNewChat,
    }),
    [
      agentTyping,
      attachImage,
      attachment,
      canReply,
      chatHeader,
      clearAttachment,
      conversationReady,
      hasEstablishedThread,
      conversationMeta?.id,
      messages,
      openTicket,
      respondToResolution,
      sendMessage,
      sendQuickReply,
      startNewChat,
      wsConnected,
    ],
  );
}
