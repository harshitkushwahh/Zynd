import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";

export default function RootNotFound() {
  return (
    <DistributorHttpErrorPage
      code={404}
      homeHref="/dashboard"
      showBack={false}
      layout="standalone"
    />
  );
}
