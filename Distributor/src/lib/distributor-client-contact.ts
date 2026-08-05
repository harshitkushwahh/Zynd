import type { DistributorInvestor } from "@/lib/dummy/types";

/** Demo full contact for client detail (distributor console). */
const DEMO_CLIENT_CONTACT: Record<string, { email: string; phone: string }> = {
  "inv-002": { email: "vishal41@gmail.com", phone: "+91 9876511889" },
  "inv-004": { email: "mohitnews@gmail.com", phone: "+91 9876552513" },
  "inv-007": { email: "karann6@gmail.com", phone: "+91 9876547004" },
  "inv-008": { email: "rahul73@gmail.com", phone: "+91 9876567640" },
  "inv-009": { email: "ravi023@gmail.com", phone: "+91 9876541782" },
  "inv-010": { email: "bipin708@gmail.com", phone: "+91 9876521951" },
  "inv-013": { email: "sam663@gmail.com", phone: "+91 9876586586" },
  "inv-014": { email: "lalitahu@gmail.com", phone: "+91 9876589591" },
};

export function resolveDistributorClientContactEmail(investor: DistributorInvestor): string {
  const demo = DEMO_CLIENT_CONTACT[investor.id];
  if (demo?.email) return demo.email;
  if (investor.emailMasked === "—") return "Email not on file";
  return investor.emailMasked;
}

export function resolveDistributorClientContactPhone(investor: DistributorInvestor): string {
  const demo = DEMO_CLIENT_CONTACT[investor.id];
  if (demo?.phone) return demo.phone;
  if (investor.mobileMasked === "—") return "Phone not on file";
  return investor.mobileMasked;
}
