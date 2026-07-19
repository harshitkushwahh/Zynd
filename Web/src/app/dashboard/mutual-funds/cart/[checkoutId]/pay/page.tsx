import { MfCartCheckoutPayRouteHost } from "@/features/invest/components/mf-payment-pay-route-host";

type MutualFundsCartPayPageProps = {
  params: Promise<{ checkoutId: string }>;
};

export default async function MutualFundsCartPayPage({ params }: MutualFundsCartPayPageProps) {
  const { checkoutId } = await params;
  return <MfCartCheckoutPayRouteHost checkoutId={checkoutId} />;
}
