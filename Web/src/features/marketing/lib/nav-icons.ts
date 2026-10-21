import {
  Home,
  Info,
  Layers,
  Mail,
  Package,
  type LucideIcon,
} from "lucide-react";

export const MARKETING_NAV_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/": Home,
  "/features": Layers,
  "/products": Package,
  "/about": Info,
  "/contact": Mail,
};
