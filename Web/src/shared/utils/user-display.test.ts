import { describe, expect, it } from "vitest";

import { getDisplayName, getUserInitials, resolveDisplayName, greetingNameFromDisplayName } from "@/shared/utils/user-display";

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

  it("prefers account name over kyc legal name", () => {
    expect(
      resolveDisplayName({
        accountName: "Ada Lovelace",
        legalFullName: "Ada Augusta Lovelace",
      }),
    ).toBe("Ada Lovelace");
  });

  it("falls back to kyc legal name when account name is empty", () => {
    expect(
      resolveDisplayName({
        accountName: "",
        legalFullName: "HARSHIT KUSHWAH",
      }),
    ).toBe("HARSHIT KUSHWAH");
  });

  it("derives greeting name from first token", () => {
    expect(greetingNameFromDisplayName("HARSHIT KUSHWAH")).toBe("HARSHIT");
    expect(greetingNameFromDisplayName("")).toBe("there");
  });
});
