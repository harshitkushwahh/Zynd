"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type DistributorPageBackButtonProps = {
  href: string;
  label?: string;
  className?: string;
};

export function DistributorPageBackButton({
  href,
  label = "Back",
  className,
}: DistributorPageBackButtonProps) {
  return (
    <Link href={href} className={cn("distributor-page-back-button", className)}>
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
