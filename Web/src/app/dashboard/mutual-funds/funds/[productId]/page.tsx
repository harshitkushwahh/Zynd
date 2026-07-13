import { MfFundDetailPage } from "@/features/invest/components/mf-fund-detail-page";

type FundDetailPageProps = {
  params: Promise<{ productId: string }>;
};

export default async function MutualFundDetailPage({ params }: FundDetailPageProps) {
  const { productId } = await params;
  return <MfFundDetailPage productId={productId} />;
}
