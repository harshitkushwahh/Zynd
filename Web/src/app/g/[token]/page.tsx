import { FamilyInviteLanding, normalizeLandingFamilyInviteToken } from "@/features/family-groups/components/family-invite-landing";
import { SiteHeader } from "@/components/auth/auth-header-actions";
import { copy } from "@/shared/config/copy";
import { notFound } from "next/navigation";

type FamilyInviteLandingPageProps = {
  params: Promise<{ token: string }>;
};

export default async function FamilyInviteLandingPage({ params }: FamilyInviteLandingPageProps) {
  const { token } = await params;
  const normalized = normalizeLandingFamilyInviteToken(token);

  if (!normalized) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <FamilyInviteLanding token={normalized} />
      </main>
      <p className="sr-only">{copy.familyGroups.join.landingLoading}</p>
    </div>
  );
}
