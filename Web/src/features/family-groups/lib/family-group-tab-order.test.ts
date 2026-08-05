import { describe, expect, it } from "vitest";

import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { orderFamilyGroupsForTabs } from "@/features/family-groups/lib/family-group-tab-order";
import { pickPrimaryFamilyGoal } from "@/features/family-groups/lib/family-group-ui";

function group(id: string, title: string): FamilyGroupSummary {
  return {
    id,
    title,
    status: "active",
    created_by_user_id: "user-1",
    member_count: 2,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
}

describe("orderFamilyGroupsForTabs", () => {
  it("moves pinned group to the front", () => {
    const groups = [group("latest", "Latest Group"), group("pinned", "Sharma Family")];
    const ordered = orderFamilyGroupsForTabs(groups, "pinned");
    expect(ordered.map((item) => item.id)).toEqual(["pinned", "latest"]);
  });
});

describe("pickPrimaryFamilyGoal", () => {
  it("prefers lowest priority over latest created goal", () => {
    const selected = pickPrimaryFamilyGoal([
      {
        id: "goal-latest",
        user_id: "user-1",
        family_group_id: "group-1",
        title: "Latest",
        priority: 3,
        target_amount_inr: 100_000,
        target_date: "2030-01-01",
        current_amount_inr: 10_000,
        existing_savings_inr: 0,
        status: "active",
        progress_pct: 10,
      },
      {
        id: "goal-pinned",
        user_id: "user-1",
        family_group_id: "group-1",
        title: "Pinned",
        priority: 1,
        target_amount_inr: 200_000,
        target_date: "2030-06-01",
        current_amount_inr: 20_000,
        existing_savings_inr: 0,
        status: "active",
        progress_pct: 10,
      },
    ]);

    expect(selected?.id).toBe("goal-pinned");
  });
});
