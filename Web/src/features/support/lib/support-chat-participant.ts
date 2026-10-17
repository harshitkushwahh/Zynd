import type { SupportConversationPayload } from "@/features/support/lib/support-api";
import { ZYND_HELP_BOT } from "@/features/support/lib/support-dummy-data";
import type { SupportAgent } from "@/features/support/lib/support-types";
import { copy } from "@/shared/config/copy";

export type SupportChatHeader = SupportAgent & {
  participant: "bot" | "human";
  showPresence: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function buildSupportChatHeader(
  conversation: Pick<
    SupportConversationPayload,
    "handler" | "participant" | "assignee_name" | "agent_presence"
  > | null,
  options?: { agentTyping?: boolean },
): SupportChatHeader {
  const participant =
    conversation?.participant ??
    (conversation?.handler === "human" ? "human" : "bot");

  if (participant === "human") {
    const name = conversation?.assignee_name?.trim() || copy.support.humanAgentFallbackName;
    const online =
      options?.agentTyping ||
      conversation?.agent_presence === "online";
    return {
      name,
      role: copy.support.humanAgentRole,
      initials: initialsFromName(name),
      status: online ? "online" : "away",
      statusLabel: online ? copy.support.agentOnline : copy.support.agentAway,
      participant: "human",
      showPresence: true,
    };
  }

  return {
    ...ZYND_HELP_BOT,
    status: "online",
    statusLabel: copy.support.agentOnline,
    participant: "bot",
    showPresence: true,
  };
}
