"use client";

import { use } from "react";

import { YourClientFamilyGroupPage } from "@/components/clients/your-client-family-group-page";

type YourClientFamilyGroupRouteProps = {
  params: Promise<{ clientId: string; groupId: string }>;
};

export default function YourClientFamilyGroupRoute({ params }: YourClientFamilyGroupRouteProps) {
  const { clientId, groupId } = use(params);
  return (
    <YourClientFamilyGroupPage listOrigin="your-book" clientId={clientId} groupId={groupId} />
  );
}
