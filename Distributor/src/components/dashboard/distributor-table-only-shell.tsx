import { DistributorTableCardShell, type DistributorTableCardShellProps } from "@/components/dashboard/distributor-table-card-shell";

export type DistributorTableOnlyShellProps = DistributorTableCardShellProps;

export function DistributorTableOnlyShell(props: DistributorTableOnlyShellProps) {
  return <DistributorTableCardShell {...props} />;
}

export { DistributorTableCardShell };
