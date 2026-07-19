import { redirect } from "next/navigation";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MutualFundsCategoryRedirectPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/mutual-funds/all?category=${encodeURIComponent(slug)}`);
}
