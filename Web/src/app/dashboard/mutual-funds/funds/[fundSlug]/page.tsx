import { MfFundDetailPage } from "@/features/invest/components/mf-fund-detail-page";

type FundDetailPageProps = {
  params: Promise<{ fundSlug: string }>;
};

export default async function MutualFundDetailPage({ params }: FundDetailPageProps) {
  const { fundSlug } = await params;
  return <MfFundDetailPage fundSlug={decodeURIComponent(fundSlug)} />;
}
