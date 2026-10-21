import "@/features/marketing/styles/landing.css";

import { MarketingLayoutShell } from "@/features/marketing/components/marketing-layout-shell";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingLayoutShell>{children}</MarketingLayoutShell>;
}
