import { describe, expect, it } from "vitest";

import { getDisplayName, getUserInitials } from "@/shared/utils/user-display";

describe("user-display", () => {
  it("derives initials from first name or email", () => {
    expect(getUserInitials("Ada", "ada@example.com")).toBe("A");
    expect(getUserInitials(null, "bob@example.com")).toBe("B");
    expect(getUserInitials(null, undefined)).toBe("U");
  });

  it("builds display name from name parts", () => {
    expect(
      getDisplayName({
        first_name: "Ada",
        middle_name: "Augusta",
        last_name: "Lovelace",
      })
    ).toBe("Ada Augusta Lovelace");
  });
});
