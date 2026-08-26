import { MfAllFundsPage } from "@/features/invest/components/mf-all-funds-page";

type AllFundsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function MutualFundsAllPage({ searchParams }: AllFundsPageProps) {
  const params = await searchParams;

  return <MfAllFundsPage initialCategorySlug={params.category ?? null} />;
}
