import { MfOrderPayRouteHost } from "@/features/invest/components/mf-payment-pay-route-host";

type OrderPayPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function MutualFundOrderPayPage({ params }: OrderPayPageProps) {
  const { orderId } = await params;
  return <MfOrderPayRouteHost orderId={orderId} />;
}
