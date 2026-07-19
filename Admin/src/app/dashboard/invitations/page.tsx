import { redirect } from "next/navigation";

export default function InvitationsRedirectPage() {
  redirect("/dashboard/settings/invitations");
}
