import { describe, expect, it } from "vitest";

import { buildSupportOverviewAnalytics } from "@/lib/support-overview-analytics";
import type { SupportTicket } from "@/lib/support-types";

function ticket(partial: Partial<SupportTicket> & Pick<SupportTicket, "id">): SupportTicket {
  return {
    subject: "Help",
    description: "Help",
    topic: "kyc",
    status: "open",
    priority: "medium",
    userId: "client-1",
    assigneeId: null,
    assigneeName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channel: "web_chat",
    handledBy: "human",
    messages: [],
    attachments: [],
    ...partial,
  };
}

describe("buildSupportOverviewAnalytics", () => {
  it("summarizes agent queue and categories from ticket topics", () => {
    const analytics = buildSupportOverviewAnalytics([
      ticket({ id: "TKT-1", topic: "kyc" }),
      ticket({ id: "TKT-2", topic: "payment", status: "pending" }),
    ]);

    expect(analytics.summary.total).toBe(2);
    expect(analytics.summary.open).toBe(1);
    expect(analytics.summary.inProgress).toBe(1);
    expect(analytics.categories).toHaveLength(2);
    expect(analytics.trends).toHaveLength(7);
    expect(analytics.sparklines.total).toHaveLength(7);
  });
});
