import type { SupportMessage } from "@/features/support/lib/support-types";

export function isOptimisticSupportMessageId(id: string): boolean {
  return id.startsWith("msg-");
}

function normalizeBody(body: string): string {
  return body.trim();
}

function sameUserPayload(a: SupportMessage, b: SupportMessage): boolean {
  if (a.role !== "user" || b.role !== "user") return false;
  return normalizeBody(a.body) === normalizeBody(b.body);
}

/** Drop local pending user rows when the server copy arrives (WS or REST). */
export function withoutMatchingOptimisticUserMessage(
  messages: SupportMessage[],
  persisted: SupportMessage,
): SupportMessage[] {
  if (persisted.role !== "user" || isOptimisticSupportMessageId(persisted.id)) {
    return messages;
  }
  return messages.filter(
    (row) =>
      !(
        isOptimisticSupportMessageId(row.id) &&
        row.role === "user" &&
        sameUserPayload(row, persisted)
      ),
  );
}

/** Merge REST/WS thread snapshot with in-flight optimistic rows. */
export function reconcileSupportMessages(
  current: SupportMessage[],
  server: SupportMessage[],
): SupportMessage[] {
  const serverIds = new Set(server.map((row) => row.id));
  const merged: SupportMessage[] = [...server];

  for (const row of current) {
    if (!isOptimisticSupportMessageId(row.id)) continue;
    if (row.role === "user") {
      const onServer = server.some((serverRow) => sameUserPayload(serverRow, row));
      if (!onServer) merged.push(row);
      continue;
    }
    if (row.role === "system") {
      const duplicate = server.some(
        (serverRow) => serverRow.role === "system" && serverRow.body === row.body,
      );
      if (!duplicate && !serverIds.has(row.id)) merged.push(row);
    }
  }

  merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return merged;
}
