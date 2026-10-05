import { describe, expect, it, beforeEach } from "vitest";

import {
  buildKycDashboardPartnerReturnUrl,
  hasKycPartnerReturnInUrl,
  isKycPartnerEmbedEnabled,
  shouldAutoOpenKycPartnerReturn,
} from "@/features/kyc/lib/kyc-partner-embed";

describe("kyc partner return auto-open", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("detects partner return params in URL", () => {
    expect(hasKycPartnerReturnInUrl("?kyc_esign_return=1&status=successful")).toBe(true);
    expect(hasKycPartnerReturnInUrl("?identity_document=iddoc_1&status=successful")).toBe(true);
    expect(hasKycPartnerReturnInUrl("")).toBe(false);
  });

  it("does not auto-open when digilocker return was already handled", () => {
    sessionStorage.setItem("kyc_digilocker_return_handled", "iddoc_1:successful");
    const search = "?identity_document=iddoc_1&status=successful";
    expect(shouldAutoOpenKycPartnerReturn(search)).toBe(false);
  });

  it("auto-opens for a fresh esign return", () => {
    const search = "?kyc_esign_return=1&kyc_form=form_1&status=successful";
    expect(shouldAutoOpenKycPartnerReturn(search)).toBe(true);
  });

  it("enables in-dialog partner embed by default", () => {
    expect(isKycPartnerEmbedEnabled()).toBe(true);
  });

  it("builds dashboard replay URL for digilocker postback params", () => {
    expect(
      buildKycDashboardPartnerReturnUrl(
        "?identity_document=iddoc_1&status=successful",
        "https://app.example.com",
      ),
    ).toBe(
      "https://app.example.com/dashboard?identity_document=iddoc_1&status=successful&kyc_digilocker_return=1",
    );
  });
});
