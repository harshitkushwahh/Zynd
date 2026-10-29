export const RESOLUTION_PROMPT_BODY = "Is this ticket resolved?";

export function isResolutionPromptBody(body: string): boolean {
  const normalized = body.trim().toLowerCase().replace(/\?+$/, "");
  return normalized === "is this ticket resolved";
}

export function isResolutionPromptMessage(message: {
  kind?: string;
  body: string;
}): boolean {
  return message.kind === "resolution_prompt" || isResolutionPromptBody(message.body);
}

/** Recompute which resolution prompt shows Yes/No (latest prompt while window is open). */
export function applyResolutionFlags(
  messages: Array<{ id: string; kind?: string; body: string; resolutionActive?: boolean }>,
  resolutionOpen: boolean,
) {
  const promptIds = messages.filter((message) => isResolutionPromptMessage(message)).map((m) => m.id);
  const latestPromptId = promptIds[promptIds.length - 1];

  return messages.map((message) => {
    if (!isResolutionPromptMessage(message)) {
      return message;
    }
    const isLatest = message.id === latestPromptId;
    return {
      ...message,
      kind: "resolution_prompt" as const,
      body: message.body.trim() ? message.body : RESOLUTION_PROMPT_BODY,
      resolutionActive: resolutionOpen && isLatest,
    };
  });
}
