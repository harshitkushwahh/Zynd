import { goalTemplateIllustrationUrlFor } from "@/features/goals/lib/goal-template-meta";

const prefetched = new Set<string>();

export function prefetchGoalTemplateIllustration(slug: string) {
  if (typeof window === "undefined") return;

  const href = goalTemplateIllustrationUrlFor(slug);
  if (!href || prefetched.has(href)) return;

  prefetched.add(href);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.append(link);
}

export function prefetchAllGoalTemplateIllustrations() {
  if (typeof window === "undefined") return;

  for (const slug of ["car", "travel", "education", "wedding", "home", "retirement"]) {
    prefetchGoalTemplateIllustration(slug);
  }
}
