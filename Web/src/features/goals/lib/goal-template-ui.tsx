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

export const GOAL_TEMPLATE_ICONS: Record<string, LucideIcon> = {
  car: Car,
  plane: Plane,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  sunset: Sunset,
  target: Target,
};

export function getGoalTemplateIcon(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Target;
  return GOAL_TEMPLATE_ICONS[iconKey] ?? Target;
}
