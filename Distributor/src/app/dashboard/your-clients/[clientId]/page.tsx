"use client";

import { use } from "react";

import { YourClientDetailPage } from "@/components/clients/your-client-detail-page";

type YourClientDetailRouteProps = {
  params: Promise<{ clientId: string }>;
};

export default function YourClientDetailRoute({ params }: YourClientDetailRouteProps) {
  const { clientId } = use(params);
  return <YourClientDetailPage listOrigin="your-book" clientId={clientId} />;
}
