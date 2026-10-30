import { redirect } from "next/navigation";

import { ZYND_AI_DASHBOARD_HREF } from "@/features/ai-assistant/lib/zynd-ai-navigation";

/** Legacy URL — use /dashboard/zyndai */
export default function DashboardAiChatRedirectPage() {
  redirect(ZYND_AI_DASHBOARD_HREF);
}
