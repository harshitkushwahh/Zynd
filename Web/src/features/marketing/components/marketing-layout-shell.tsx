import { LandingFooter } from "@/features/marketing/components/landing-footer";
import { LandingNavbar } from "@/features/marketing/components/landing-navbar";

type MarketingLayoutShellProps = {
  children: React.ReactNode;
};

/** Shared marketing chrome: fixed navbar, scrollable main, footer. */
export function MarketingLayoutShell({ children }: MarketingLayoutShellProps) {
  return (
    <div className="landing-shell flex min-h-dvh flex-col">
      <LandingNavbar />
      <main className="landing-main flex flex-1 flex-col">{children}</main>
      <LandingFooter />
    </div>
  );
}
