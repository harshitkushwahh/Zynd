"use client";

import { use } from "react";

import { YourClientFamilyGroupPage } from "@/components/clients/your-client-family-group-page";

type SystemResidentFamilyGroupRouteProps = {
  params: Promise<{ clientId: string; groupId: string }>;
};

export default function SystemResidentFamilyGroupRoute({ params }: SystemResidentFamilyGroupRouteProps) {
  const { clientId, groupId } = use(params);
  return (
    <YourClientFamilyGroupPage
      listOrigin="system-resident"
      clientId={clientId}
      groupId={groupId}
    />
  );
}
