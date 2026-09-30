import { redirect } from "next/navigation";

import { MITRA_RECOMMENDATION_QUERY_PARAM } from "@/features/recommendations/hooks/use-mitra-txn-recommendation-handler";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function MutualFundsRecommendationPage({ params }: PageProps) {
  const { token } = await params;
  redirect(`/dashboard/mutual-funds?${MITRA_RECOMMENDATION_QUERY_PARAM}=${encodeURIComponent(token)}`);
}
