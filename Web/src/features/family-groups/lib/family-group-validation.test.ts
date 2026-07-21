import { describe, expect, it } from "vitest";

import {
  hasFamilyGroupFormErrors,
  validateFamilyGroupForm,
  validateInviteForm,
  validateMemberNickname,
} from "@/features/family-groups/lib/family-group-validation";

describe("family-group-validation", () => {
  it("rejects empty group title", () => {
    const errors = validateFamilyGroupForm({ title: "   ", description: "", tag: "" });
    expect(errors.title).toBeTruthy();
    expect(hasFamilyGroupFormErrors(errors)).toBe(true);
  });

  it("accepts valid group form", () => {
    const errors = validateFamilyGroupForm({
      title: "Sharma Family",
      description: "Primary household",
      tag: "Primary",
    });
    expect(hasFamilyGroupFormErrors(errors)).toBe(false);
  });

  it("rejects invalid invite email", () => {
    const errors = validateInviteForm({ email: "not-an-email", badgeKey: "" });
    expect(errors.email).toBeTruthy();
  });

  it("requires custom badge label", () => {
    const errors = validateInviteForm({ email: "member@example.com", badgeKey: "custom", customBadgeLabel: "  " });
    expect(errors.customBadgeLabel).toBeTruthy();
  });

  it("rejects long nicknames", () => {
    expect(validateMemberNickname("a".repeat(65))).toBeTruthy();
  });
});
