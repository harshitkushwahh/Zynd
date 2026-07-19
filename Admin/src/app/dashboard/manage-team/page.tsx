import { redirect } from "next/navigation";

export default function ManageTeamRedirectPage() {
  redirect("/dashboard/settings/team");
}
