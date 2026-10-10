import { SupportInviteOnboardingPageShell } from "@/components/auth/support-invite-onboarding-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export default function SupportAcceptInvitePage() {
  return <SupportInviteOnboardingPageShell />;
}
