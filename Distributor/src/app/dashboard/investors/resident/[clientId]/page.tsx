"use client";

import { use } from "react";

import { YourClientDetailPage } from "@/components/clients/your-client-detail-page";

type SystemResidentClientDetailRouteProps = {
  params: Promise<{ clientId: string }>;
};

export default function SystemResidentClientDetailRoute({
  params,
}: SystemResidentClientDetailRouteProps) {
  const { clientId } = use(params);
  return <YourClientDetailPage listOrigin="system-resident" clientId={clientId} />;
}
