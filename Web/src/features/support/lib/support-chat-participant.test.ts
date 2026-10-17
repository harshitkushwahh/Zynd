import { describe, expect, it } from "vitest";

import { buildSupportChatHeader } from "@/features/support/lib/support-chat-participant";

describe("buildSupportChatHeader", () => {
  it("shows online presence for bot threads", () => {
    const header = buildSupportChatHeader({
      handler: "bot",
      participant: "bot",
      assignee_name: null,
      agent_presence: null,
    });
    expect(header.participant).toBe("bot");
    expect(header.showPresence).toBe(true);
    expect(header.status).toBe("online");
  });

  it("shows online for human assignee when presence is online", () => {
    const header = buildSupportChatHeader({
      handler: "human",
      participant: "human",
      assignee_name: "Alex Agent",
      agent_presence: "online",
    });
    expect(header.showPresence).toBe(true);
    expect(header.status).toBe("online");
    expect(header.name).toBe("Alex Agent");
  });
});
