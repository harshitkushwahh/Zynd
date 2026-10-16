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
