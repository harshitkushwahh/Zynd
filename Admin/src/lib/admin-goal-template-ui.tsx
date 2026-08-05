import {
  Car,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Sunset,
  Target,
  type LucideIcon,
} from "lucide-react";

export const ADMIN_GOAL_TEMPLATE_ICONS: Record<string, LucideIcon> = {
  car: Car,
  plane: Plane,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  sunset: Sunset,
  target: Target,
};

export function getAdminGoalTemplateIcon(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Target;
  return ADMIN_GOAL_TEMPLATE_ICONS[iconKey] ?? Target;
}

export function getAdminGoalTemplateIconModifier(slug?: string | null, iconKey?: string | null) {
  const key = slug ?? iconKey ?? "custom";
  const allowed = new Set(["car", "travel", "education", "wedding", "home", "retirement", "custom"]);
  return allowed.has(key) ? key : "custom";
}

export function adminGoalTemplateIconSlug(template?: { slug?: string | null } | null) {
  return template?.slug ?? "custom";
}
