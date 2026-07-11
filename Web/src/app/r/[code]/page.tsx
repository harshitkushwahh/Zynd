import { ReferralLanding } from "@/features/referral/components/referral-landing";
import { normalizeReferralCode } from "@/features/referral/lib/referral-storage";
import { SiteHeader } from "@/components/auth/auth-header-actions";
import { copy } from "@/shared/config/copy";
import { notFound } from "next/navigation";

type ReferralLandingPageProps = {
  params: Promise<{ code: string }>;
};

export default async function ReferralLandingPage({ params }: ReferralLandingPageProps) {
  const { code } = await params;
  const normalized = normalizeReferralCode(code);

  if (!normalized) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ReferralLanding code={normalized} />
      </main>
      <p className="sr-only">{copy.referral.landingLoading}</p>
    </div>
  );
}
