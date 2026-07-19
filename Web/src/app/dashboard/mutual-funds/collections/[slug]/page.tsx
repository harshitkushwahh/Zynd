import { MfCollectionPage } from "@/features/invest/components/mf-collection-page";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MutualFundsCollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  return <MfCollectionPage slug={slug} />;
}
