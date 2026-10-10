"use client";

import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const distributorActionButtonVariants = cva("distributor-action-button", {
  variants: {
    variant: {
      primary: "distributor-action-button--primary",
      outline: "distributor-action-button--outline",
      destructive: "distributor-action-button--destructive",
      /** Icon-only (no label) with trailing chevron */
      chevron: "distributor-action-button--chevron",
      /** Square icon control (navbar utilities) */
      icon: "distributor-action-button--icon",
      /** Dashboard date display control */
      date: "distributor-action-button--date",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

export type DistributorActionButtonVariant = NonNullable<
  VariantProps<typeof distributorActionButtonVariants>["variant"]
>;

type DistributorActionButtonProps = Omit<ComponentProps<typeof Button>, "variant"> &
  VariantProps<typeof distributorActionButtonVariants> & {
    asChild?: boolean;
  };

function mapBaseButtonVariant(
  variant: DistributorActionButtonVariant | null | undefined,
): ComponentProps<typeof Button>["variant"] {
  switch (variant) {
    case "destructive":
      return "destructive";
    case "outline":
    case "chevron":
    case "icon":
    case "date":
      return "outline";
    case "primary":
    default:
      return "default";
  }
}

export function DistributorActionButton({
  className,
  variant = "primary",
  children,
  asChild = false,
  ...props
}: DistributorActionButtonProps) {
  const isChevron = variant === "chevron";
  const mergedClassName = cn(
    buttonVariants({ variant: mapBaseButtonVariant(variant) }),
    distributorActionButtonVariants({ variant }),
    className,
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
    return cloneElement(child, {
      ...props,
      className: cn(mergedClassName, child.props.className),
      ...(isChevron
        ? {
            children: (
              <>
                {child.props.children}
                <ChevronRight
                  className="distributor-action-button__chevron size-3.5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </>
            ),
          }
        : {}),
    });
  }

  return (
    <Button
      type="button"
      variant={mapBaseButtonVariant(variant)}
      className={mergedClassName}
      {...props}
    >
      {children as ReactNode}
      {isChevron ? (
        <ChevronRight
          className="distributor-action-button__chevron size-3.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
    </Button>
  );
}
