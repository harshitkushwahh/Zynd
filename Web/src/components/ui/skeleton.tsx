import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-[var(--radius-control)] bg-skeleton",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
