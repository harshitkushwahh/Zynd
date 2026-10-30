"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  beginNewSupportConversation,
  getCurrentSupportConversation,
  getSupportTicketThread,
  isSupportThreadLocked,
  mapConversationMessages,
  postBotHelpFeedback,
  postSupportMessage,
  respondSupportResolution,
  type SupportConversationPayload,
} from "@/features/support/lib/support-api";
import { ApiError } from "@/lib/api-client";
import { buildSupportChatHeader } from "@/features/support/lib/support-chat-participant";
import {
  connectSupportRealtime,
  emitMessagesRead,
  subscribeSupportConversation,
  type SupportRealtimeEvent,
} from "@/features/support/lib/support-realtime";
import {
  SUPPORT_QUICK_REPLIES,
  ZYND_HELP_BOT,
  ZYND_HELP_BOT_GREETING,
} from "@/features/support/lib/support-dummy-data";
import { createSupportMessageId } from "@/features/support/lib/support-format";
import {
  isOptimisticSupportMessageId,
  reconcileSupportMessages,
  withoutMatchingOptimisticUserMessage,
} from "@/features/support/lib/support-message-merge";
import {
  applyResolutionFlags,
  isResolutionPromptMessage,
  RESOLUTION_PROMPT_BODY,
} from "@/features/support/lib/support-resolution";
import {
  SUPPORT_MESSAGE_MAX_CHARS,
  validateSupportImageFile,
} from "@/features/support/lib/support-message-limits";
import type {
  SupportImageAttachment,
  SupportMessage,
} from "@/features/support/lib/support-types";
import { copy } from "@/shared/config/copy";
import { toast } from "sonner";
const POLL_MS = 4000;
const REALTIME_REFRESH_MS = 350;

function realtimeEventAppliesToThread(
  event: SupportRealtimeEvent,
  conversationId: string | null,
  ticketId: string | null,
): boolean {
  if (event.conversation_id && conversationId && event.conversation_id === conversationId) {
    return true;
  }
  if (event.ticket_id && ticketId && event.ticket_id === ticketId) {
    return true;
  }
  if (!conversationId && !ticketId) {
    return Boolean(event.conversation_id || event.ticket_id);
  }
  return false;
}

function threadLockedFromEvent(event: SupportRealtimeEvent): boolean {
  return event.ticket_status === "resolved" || event.status === "closed";
}

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
  const rawBody = typeof message.body === "string" ? message.body : "";
  const createdAt = typeof message.created_at === "string" ? message.created_at : null;
  if (!id || !createdAt) return null;
  const roleRaw = message.role;
  const role =
    roleRaw === "user" ? "user" : roleRaw === "system" ? "system" : "agent";
  const kindRaw = typeof message.kind === "string" ? message.kind : "text";
  const isPrompt =
    kindRaw === "resolution_prompt" ||
    isResolutionPromptMessage({ kind: kindRaw, body: rawBody });
  const kind = isPrompt ? "resolution_prompt" : kindRaw === "text" ? "text" : undefined;
  const body = isPrompt && !rawBody.trim() ? RESOLUTION_PROMPT_BODY : rawBody;
  const resolutionActive = isPrompt ? Boolean(message.resolution_active ?? true) : false;

  const authorRole =
    roleRaw === "user" || roleRaw === "bot" || roleRaw === "agent" || roleRaw === "system"
      ? roleRaw
      : "agent";

  return {
    id,
    role,
    authorRole,
    body,
    createdAt,
    kind,
    resolutionActive,
    helpFeedback:
      message.help_feedback === "yes" ||
      message.help_feedback === "no" ||
      message.help_feedback === "pending"
        ? message.help_feedback
        : undefined,
    helpFeedbackActive: Boolean(message.help_feedback_active),
    senderName: typeof message.sender_name === "string" ? message.sender_name : undefined,
    attachmentId:
      typeof message.attachment_document_id === "string"
        ? message.attachment_document_id
        : undefined,
    imageName:
      typeof message.attachment_filename === "string"
        ? message.attachment_filename
        : undefined,
    customerReadAt:
      typeof message.customer_read_at === "string" ? message.customer_read_at : undefined,
    supportReadAt:
      typeof message.support_read_at === "string" ? message.support_read_at : undefined,
    supportReadBy:
      message.support_read_by === "bot" || message.support_read_by === "agent"
        ? message.support_read_by
        : undefined,
  };
}

function isPersistedMessageId(id: string): boolean {
  if (id === "zynd-help-bot-greeting") return false;
  return !isOptimisticSupportMessageId(id);
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
  const refreshTimerRef = useRef<number | null>(null);

  const applyConversation = useCallback((conversation: SupportConversationPayload) => {
    ticketIdRef.current = conversation.ticket_id;
    conversationIdRef.current = conversation.id;
    setConversationMeta(conversation);
    setHandler(conversation.handler);
    if (conversation.handler !== "human") {
      setAttachment((current) => {
        if (current) {
          URL.revokeObjectURL(current.url);
          objectUrlsRef.current.delete(current.url);
        }
        return null;
      });
    }
    const locked = isSupportThreadLocked(conversation);
    setCanReply(!locked);
    setResolutionOpen(Boolean(conversation.resolution_open) && !locked);
    setMessages((current) =>
      reconcileSupportMessages(current, messagesFromConversation(conversation)),
    );
  }, []);

  const refreshConversation = useCallback(() => {
    if (sendingRef.current) return Promise.resolve();
    const ticketId = ticketIdRef.current;
    const request = ticketId
      ? getSupportTicketThread(ticketId)
      : getCurrentSupportConversation();
    return request
      .then((conversation) => {
        applyConversation(conversation);
      })
      .catch(() => undefined);
  }, [applyConversation]);

  const scheduleRefreshConversation = useCallback(() => {
    if (refreshTimerRef.current !== null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshConversation();
    }, REALTIME_REFRESH_MS);
  }, [refreshConversation]);

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const canReplyRef = useRef(canReply);
  canReplyRef.current = canReply;

  const handleRealtimeEvent = useCallback(
    (event: SupportRealtimeEvent) => {
      const applies = realtimeEventAppliesToThread(
        event,
        conversationIdRef.current,
        ticketIdRef.current,
      );
      if (event.type === "agent:typing") {
        if (handlerRef.current === "human") {
          setHumanAgentTyping(Boolean(event.typing));
        }
        return;
      }
      if (event.type === "message:new" && event.message) {
        const mapped = mapRealtimeMessage(event.message);
        if (!mapped) return;
        const allowResolution = canReplyRef.current;
        if (
          allowResolution &&
          mapped.kind === "resolution_prompt" &&
          mapped.resolutionActive
        ) {
          setResolutionOpen(true);
        } else if (mapped.kind === "resolution_prompt") {
          mapped.resolutionActive = false;
        }
        setMessages((current) => {
          if (current.some((row) => row.id === mapped.id)) return current;
          let next = current.filter((row) => row.id !== "zynd-help-bot-greeting");
          next = withoutMatchingOptimisticUserMessage(next, mapped);
          next = [...next, mapped];
          if (allowResolution && mapped.kind === "resolution_prompt" && mapped.resolutionActive) {
            return applyResolutionFlags(next, true) as SupportMessage[];
          }
          return next;
        });
        return;
      }
      if (event.type === "message:read") {
        if (!applies) return;
        const messageId = event.message_id;
        if (!messageId) return;
        setMessages((current) =>
          current.map((row) => {
            if (row.id !== messageId) return row;
            if (event.side === "customer") {
              return { ...row, customerReadAt: event.read_at ?? row.customerReadAt };
            }
            if (event.side === "support") {
              return {
                ...row,
                supportReadAt: event.read_at ?? row.supportReadAt,
                supportReadBy: event.support_read_by ?? row.supportReadBy,
              };
            }
            return row;
          }),
        );
        return;
      }
      if (event.type === "ticket:updated") {
        if (!applies) return;
        const nextResolutionOpen =
          typeof event.resolution_open === "boolean" ? event.resolution_open : null;
        const locked = threadLockedFromEvent(event);
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
              nextResolutionOpen !== null ? nextResolutionOpen : current.resolution_open,
            status: event.status ?? current.status,
          };
        });
        if (locked) {
          setCanReply(false);
          setResolutionOpen(false);
          scheduleRefreshConversation();
        } else if (nextResolutionOpen !== null) {
          setResolutionOpen(nextResolutionOpen);
          setMessages((current) =>
            applyResolutionFlags(current, nextResolutionOpen) as SupportMessage[],
          );
        }
        if (event.handler === "human" || event.participant === "human") {
          setHandler("human");
        }
        return;
      }
      if (event.type === "conversation:locked") {
        if (!applies) return;
        setCanReply(false);
        setResolutionOpen(false);
        setConversationMeta((current) => {
          if (!current) return current;
          return {
            ...current,
            status: "closed",
            ticket_status: "resolved",
            resolution_open: false,
          };
        });
        scheduleRefreshConversation();
      }
    },
    [scheduleRefreshConversation],
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
    if (!wsConnected || !canReply) return;
    const conversationId = conversationIdRef.current;
    if (!conversationId) return;
    const unreadInbound = messages
      .filter(
        (row) =>
          row.role !== "user" &&
          !row.customerReadAt &&
          isPersistedMessageId(row.id),
      )
      .map((row) => row.id);
    if (!unreadInbound.length) return;
    emitMessagesRead(wsSendRef.current, {
      conversationId,
      ticketId: ticketIdRef.current,
      messageIds: unreadInbound,
    });
  }, [messages, wsConnected, canReply]);

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
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
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
    if (!file) {
      return;
    }
    if (handlerRef.current !== "human") {
      toast.error(copy.support.uploadImageBotDisabledHint);
      return;
    }
    const check = validateSupportImageFile(file);
    if (!check.ok) {
      const message =
        check.reason === "empty"
          ? copy.support.imageEmptyError
          : check.reason === "too_large"
            ? copy.support.imageTooLargeError
            : copy.support.imageInvalidTypeError;
      toast.error(message);
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
      const activeImage = handler === "human" ? image ?? attachment : null;
      if ((!body && !activeImage) || botTyping || sendingRef.current || !canReply || resolutionOpen) {
        return;
      }
      if (body.length > SUPPORT_MESSAGE_MAX_CHARS) {
        toast.error(copy.support.messageTooLongError);
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
    [applyConversation, attachment, botTyping, canReply, handler, resolutionOpen],
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

  const submitHelpFeedback = useCallback(
    (messageId: string, choice: "yes" | "no") => {
      if (!isPersistedMessageId(messageId) || sendingRef.current) {
        return Promise.resolve();
      }
      sendingRef.current = true;
      if (choice === "yes") {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, helpFeedback: "yes", helpFeedbackActive: false }
              : message,
          ),
        );
      }
      return postBotHelpFeedback(messageId, choice)
        .then((conversation) => {
          applyConversation(conversation);
        })
        .catch(() => {
          void refreshConversation();
        })
        .finally(() => {
          sendingRef.current = false;
        });
    },
    [applyConversation, refreshConversation],
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
      handler,
      resolutionOpen,
      conversationReady,
      hasEstablishedThread,
      threadKey: conversationMeta?.id ?? "none",
      sendMessage,
      sendQuickReply,
      openTicket,
      respondToResolution,
      submitHelpFeedback,
      startNewChat,
      refreshConversation,
    }),
    [
      agentTyping,
      attachImage,
      attachment,
      canReply,
      handler,
      resolutionOpen,
      chatHeader,
      clearAttachment,
      conversationReady,
      hasEstablishedThread,
      conversationMeta?.id,
      messages,
      openTicket,
      respondToResolution,
      submitHelpFeedback,
      sendMessage,
      sendQuickReply,
      startNewChat,
      refreshConversation,
      wsConnected,
    ],
  );
}
