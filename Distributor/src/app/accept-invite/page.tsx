import { DistributorInviteOnboardingPageShell } from "@/components/auth/distributor-invite-onboarding-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export default function DistributorAcceptInvitePage() {
  return <DistributorInviteOnboardingPageShell />;
}
