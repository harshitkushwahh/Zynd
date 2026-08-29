"use client";

import { use } from "react";

import { RecommendationsPage } from "@/components/recommendations/recommendations-page";

type RecommendationsRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function RecommendationsRoutePage({ params }: RecommendationsRoutePageProps) {
  const { tab } = use(params);
  return <RecommendationsPage tabSlug={tab?.[0]} />;
}
