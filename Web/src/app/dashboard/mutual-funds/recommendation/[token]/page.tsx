import { MitraTxnRecommendationPage } from "@/features/recommendations/components/mitra-txn-recommendation-page";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function MutualFundsRecommendationPage({ params }: PageProps) {
  const { token } = await params;
  return <MitraTxnRecommendationPage token={token} />;
}
