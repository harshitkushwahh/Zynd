import { DistributorHttpErrorPage } from "@/components/errors/distributor-http-error-page";
import { DashboardErrorShell } from "@/components/errors/dashboard-error-shell";

export default function DashboardNotFound() {
  return (
    <DashboardErrorShell>
      <DistributorHttpErrorPage code={404} homeHref="/dashboard" layout="viewport" />
    </DashboardErrorShell>
  );
}
