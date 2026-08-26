import { describe, expect, it } from "vitest";

import {
  getIndianBankLogoUrl,
  parseBankNameFromAccountLabel,
  resolveIndianBankSlug,
  resolveIndianBankSlugFromIfsc,
  resolveIndianBankSlugFromName,
} from "@/shared/lib/indian-bank-logo";

describe("resolveIndianBankSlugFromIfsc", () => {
  it("maps common IFSC prefixes", () => {
    expect(resolveIndianBankSlugFromIfsc("HDFC0001234")).toBe("hdfc-bank");
    expect(resolveIndianBankSlugFromIfsc("SBIN0000456")).toBe("state-bank-of-india");
    expect(resolveIndianBankSlugFromIfsc("KKBK0007890")).toBe("kotak-mahindra-bank");
    expect(resolveIndianBankSlugFromIfsc("STCB0000065")).toBe("sbm-bank-india-limited");
    expect(resolveIndianBankSlugFromIfsc("SCBL0001234")).toBe("standard-chartered");
  });
});

describe("resolveIndianBankSlugFromName", () => {
  it("matches bank names from verification payloads", () => {
    expect(resolveIndianBankSlugFromName("HDFC Bank Limited")).toBe("hdfc-bank");
    expect(resolveIndianBankSlugFromName("Kotak Mahindra Bank")).toBe("kotak-mahindra-bank");
    expect(resolveIndianBankSlugFromName("State Bank of India")).toBe("state-bank-of-india");
    expect(resolveIndianBankSlugFromName("SBM BANK INDIA LIMITED")).toBe("sbm-bank-india-limited");
  });
});

describe("resolveIndianBankSlug", () => {
  it("prefers IFSC over name", () => {
    expect(
      resolveIndianBankSlug({
        bankName: "Some Other Bank",
        ifscCode: "HDFC0001234",
      }),
    ).toBe("hdfc-bank");
  });
});

describe("getIndianBankLogoUrl", () => {
  it("builds CDN urls", () => {
    expect(getIndianBankLogoUrl("hdfc-bank")).toBe(
      "https://indian-bank-logos.vercel.app/logos/hdfc-bank.png",
    );
    expect(getIndianBankLogoUrl("hdfc-bank", "horizontal")).toBe(
      "https://indian-bank-logos.vercel.app/logos/hdfc-bank-horizontal.png",
    );
  });
});

describe("parseBankNameFromAccountLabel", () => {
  it("strips masked account suffixes", () => {
    expect(parseBankNameFromAccountLabel("Kotak Mahindra ....9725")).toBe("Kotak Mahindra");
    expect(parseBankNameFromAccountLabel("HDFC Bank ••••1234")).toBe("HDFC Bank");
  });
});
