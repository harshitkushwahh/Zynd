import type { LucideIcon } from "lucide-react";

import {
  ADMIN_PAGE_DESCRIPTION_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
  ADMIN_TAB_SECTION_TITLE_CLASS,
} from "@/components/dashboard/admin-typography";
import { cn } from "@/lib/utils";

type AdminSectionTitleVariant = "tab" | "section";

const VARIANT_CONFIG = {
  tab: {
    Tag: "p" as const,
    className: ADMIN_TAB_SECTION_TITLE_CLASS,
    iconClassName: "size-3.5",
  },
  section: {
    Tag: "p" as const,
    className: ADMIN_SECTION_TITLE_CLASS,
    iconClassName: "size-3",
  },
};

export function AdminSectionTitle({
  children,
  icon: Icon,
  description,
  variant = "tab",
  className,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  description?: string;
  variant?: AdminSectionTitleVariant;
  className?: string;
}) {
  const { Tag, className: variantClass, iconClassName } = VARIANT_CONFIG[variant];

  const title = (
    <Tag className={cn(variantClass, className)}>{children}</Tag>
  );

  const content = Icon ? (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className={cn("shrink-0 text-muted-foreground", iconClassName)} aria-hidden />
      {title}
    </div>
  ) : (
    title
  );

  if (!description) {
    return <div className="min-w-0">{content}</div>;
  }

  return (
    <div className="min-w-0">
      {content}
      <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>{description}</p>
    </div>
  );
}
