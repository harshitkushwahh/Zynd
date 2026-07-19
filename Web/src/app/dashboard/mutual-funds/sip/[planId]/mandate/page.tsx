import { MfSipMandateRouteHost } from "@/features/invest/components/mf-payment-pay-route-host";

type MutualFundsSipMandatePageProps = {
  params: Promise<{ planId: string }>;
};

export default async function MutualFundsSipMandatePage({ params }: MutualFundsSipMandatePageProps) {
  const { planId } = await params;
  return <MfSipMandateRouteHost planId={planId} />;
}
