import type { DistributorInvestor } from "@/lib/distributor-types";

export function resolveDistributorClientContactEmail(investor: DistributorInvestor): string {
  if (investor.emailMasked === "—") return "Email not on file";
  return investor.emailMasked;
}

export function resolveDistributorClientContactPhone(investor: DistributorInvestor): string {
  if (investor.mobileMasked === "—") return "Phone not on file";
  return investor.mobileMasked;
}
