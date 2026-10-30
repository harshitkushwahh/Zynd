export type GoalTemplateTheme = {
  iconBadgeClass: string;
  headerIconClass: string;
  sliderIndicatorClass: string;
  accentTextClass: string;
  accentIconClass: string;
  inputFocusClass: string;
  sliderThumbClass: string;
};

const DEFAULT_GOAL_TEMPLATE_THEME: GoalTemplateTheme = {
  iconBadgeClass: "border-border/70 bg-muted/40 text-muted-foreground",
  headerIconClass: "border-border/70 bg-muted/30 text-muted-foreground",
  sliderIndicatorClass: "bg-primary",
  accentTextClass: "text-foreground",
  accentIconClass: "text-muted-foreground",
  inputFocusClass: "focus-visible:border-ring focus-visible:ring-ring/25",
  sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-primary/30",
};

const GOAL_TEMPLATE_THEMES: Record<string, GoalTemplateTheme> = {
  car: {
    iconBadgeClass:
      "border-blue-200/70 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
    headerIconClass:
      "border-blue-200/70 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
    sliderIndicatorClass: "bg-blue-500",
    accentTextClass: "text-blue-600 dark:text-blue-300",
    accentIconClass: "text-blue-600 dark:text-blue-400",
    inputFocusClass: "focus-visible:border-blue-300 focus-visible:ring-blue-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-blue-500/30",
  },
  travel: {
    iconBadgeClass:
      "border-teal-200/70 bg-teal-500/10 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300",
    headerIconClass:
      "border-teal-200/70 bg-teal-500/10 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300",
    sliderIndicatorClass: "bg-teal-500",
    accentTextClass: "text-teal-600 dark:text-teal-300",
    accentIconClass: "text-teal-600 dark:text-teal-400",
    inputFocusClass: "focus-visible:border-teal-300 focus-visible:ring-teal-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-teal-500/30",
  },
  education: {
    iconBadgeClass:
      "border-violet-200/70 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    headerIconClass:
      "border-violet-200/70 bg-violet-500/10 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
    sliderIndicatorClass: "bg-violet-500",
    accentTextClass: "text-violet-600 dark:text-violet-300",
    accentIconClass: "text-violet-600 dark:text-violet-400",
    inputFocusClass: "focus-visible:border-violet-300 focus-visible:ring-violet-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-violet-500/30",
  },
  wedding: {
    iconBadgeClass:
      "border-rose-200/70 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
    headerIconClass:
      "border-rose-200/70 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
    sliderIndicatorClass: "bg-rose-500",
    accentTextClass: "text-rose-600 dark:text-rose-300",
    accentIconClass: "text-rose-600 dark:text-rose-400",
    inputFocusClass: "focus-visible:border-rose-300 focus-visible:ring-rose-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-rose-500/30",
  },
  home: {
    iconBadgeClass:
      "border-emerald-200/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    headerIconClass:
      "border-emerald-200/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    sliderIndicatorClass: "bg-emerald-500",
    accentTextClass: "text-emerald-600 dark:text-emerald-300",
    accentIconClass: "text-emerald-600 dark:text-emerald-400",
    inputFocusClass: "focus-visible:border-emerald-300 focus-visible:ring-emerald-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-emerald-500/30",
  },
  retirement: {
    iconBadgeClass:
      "border-amber-200/70 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    headerIconClass:
      "border-amber-200/70 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    sliderIndicatorClass: "bg-amber-500",
    accentTextClass: "text-amber-600 dark:text-amber-300",
    accentIconClass: "text-amber-600 dark:text-amber-400",
    inputFocusClass: "focus-visible:border-amber-300 focus-visible:ring-amber-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-amber-500/30",
  },
  custom: {
    iconBadgeClass:
      "border-indigo-200/70 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
    headerIconClass:
      "border-indigo-200/70 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
    sliderIndicatorClass: "bg-indigo-500",
    accentTextClass: "text-indigo-600 dark:text-indigo-300",
    accentIconClass: "text-indigo-600 dark:text-indigo-400",
    inputFocusClass: "focus-visible:border-indigo-300 focus-visible:ring-indigo-500/25",
    sliderThumbClass: "[&_[data-slot=slider-thumb]]:ring-indigo-500/30",
  },
};

export type GoalTemplateIconTheme = Pick<GoalTemplateTheme, "iconBadgeClass" | "headerIconClass">;

export function goalTemplateThemeFor(slug: string): GoalTemplateTheme {
  return GOAL_TEMPLATE_THEMES[slug] ?? DEFAULT_GOAL_TEMPLATE_THEME;
}

export function goalTemplateIconThemeFor(slug: string): GoalTemplateIconTheme {
  const theme = goalTemplateThemeFor(slug);
  return {
    iconBadgeClass: theme.iconBadgeClass,
    headerIconClass: theme.headerIconClass,
  };
}

/** Template strip / dialog heroes — compact JPEGs under `/public/goals`. */
const GOAL_TEMPLATE_ILLUSTRATIONS: Record<string, string> = {
  car: "/goals/car.jpg",
  travel: "/goals/travel.jpg",
  education: "/goals/education.jpg",
  wedding: "/goals/weeding.jpg",
  home: "/goals/home.jpg",
  retirement: "/goals/retire.jpg",
};

/** Your-goals rich cards — full PNG heroes at `/public` root (`goal-*.png`, `goals-wedding.png`). */
const GOAL_RICH_CARD_ILLUSTRATIONS: Record<string, string> = {
  car: "/goal-car.png",
  travel: "/goal-travel.png",
  education: "/goal-edu.png",
  wedding: "/goals-wedding.png",
  home: "/goal-home.png",
  retirement: "/goal-retire.png",
};

export function goalTemplateIllustrationUrlFor(slug: string) {
  return GOAL_TEMPLATE_ILLUSTRATIONS[slug] ?? null;
}

export function goalRichCardIllustrationUrlFor(slug: string) {
  return GOAL_RICH_CARD_ILLUSTRATIONS[slug] ?? null;
}

export function resolveGoalTemplateIllustrationUrl(slug: string, imageUrl?: string | null) {
  return goalTemplateIllustrationUrlFor(slug) ?? imageUrl ?? null;
}

export function resolveGoalRichCardIllustrationUrl(slug: string, imageUrl?: string | null) {
  return goalRichCardIllustrationUrlFor(slug) ?? imageUrl ?? null;
}

/** Family rich cards — full PNG heroes at `/public` root (`family-goal-*.png`, fallback `family-card.png`). */
const FAMILY_GOAL_RICH_CARD_ILLUSTRATIONS: Record<string, string> = {
  car: "/family-goal-car.png",
  travel: "/family-goal-travel.png",
  education: "/family-goal-education.png",
  wedding: "/family-goal-wedding.png",
  home: "/family-goal-home.png",
  retirement: "/family-goal-retire.png",
};

const FAMILY_GOAL_RICH_CARD_FALLBACK = "/family-card.png";

export function familyGoalRichCardIllustrationUrlFor(slug: string) {
  return FAMILY_GOAL_RICH_CARD_ILLUSTRATIONS[slug] ?? FAMILY_GOAL_RICH_CARD_FALLBACK;
}

export function resolveFamilyGoalRichCardIllustrationUrl(slug: string) {
  return familyGoalRichCardIllustrationUrlFor(slug);
}

export function goalTemplateSlugForId(
  templateId: string | null | undefined,
  templates: ReadonlyArray<{ id: string; slug: string }>,
) {
  if (!templateId) return "custom";
  return templates.find((template) => template.id === templateId)?.slug ?? "custom";
}

export const FAMILY_GOAL_RICH_CARD_ILLUSTRATION_URLS = [
  ...Object.values(FAMILY_GOAL_RICH_CARD_ILLUSTRATIONS),
  FAMILY_GOAL_RICH_CARD_FALLBACK,
  "/family-info.png",
] as const;

/** CSS custom properties for `GoalRichCard` surface + hero soft layer (tinted per template). */
export type GoalRichCardSurfaceVars = {
  "--grc-accent": string;
  "--grc-light-from": string;
  "--grc-light-to": string;
  "--grc-light-glow": string;
  "--grc-dark-from": string;
  "--grc-dark-mid": string;
  "--grc-dark-to": string;
  "--grc-dark-glow": string;
  "--grc-hero-soft": string;
};

const DEFAULT_GOAL_RICH_CARD_SURFACE_VARS: GoalRichCardSurfaceVars = {
  "--grc-accent": "#6366f1",
  "--grc-light-from": "#f8fafc",
  "--grc-light-to": "#eef2ff",
  "--grc-light-glow": "#c7d2fe",
  "--grc-dark-from": "#312e81",
  "--grc-dark-mid": "#0f172a",
  "--grc-dark-to": "#020617",
  "--grc-dark-glow": "#6366f1",
  "--grc-hero-soft": "#a5b4fc",
};

const GOAL_RICH_CARD_SURFACE_VARS: Record<string, GoalRichCardSurfaceVars> = {
  car: {
    "--grc-accent": "#2563eb",
    "--grc-light-from": "#eef4ff",
    "--grc-light-to": "#dbeafe",
    "--grc-light-glow": "#93c5fd",
    "--grc-dark-from": "#1d4ed8",
    "--grc-dark-mid": "#0c1929",
    "--grc-dark-to": "#030712",
    "--grc-dark-glow": "#3b82f6",
    "--grc-hero-soft": "#60a5fa",
  },
  home: {
    "--grc-accent": "#059669",
    "--grc-light-from": "#f8fafc",
    "--grc-light-to": "#d1fae5",
    "--grc-light-glow": "#6ee7b7",
    "--grc-dark-from": "#064e3b",
    "--grc-dark-mid": "#0f172a",
    "--grc-dark-to": "#020617",
    "--grc-dark-glow": "#10b981",
    "--grc-hero-soft": "#34d399",
  },
  retirement: {
    "--grc-accent": "#d97706",
    "--grc-light-from": "#fffbeb",
    "--grc-light-to": "#fef3c7",
    "--grc-light-glow": "#fcd34d",
    "--grc-dark-from": "#78350f",
    "--grc-dark-mid": "#1c1917",
    "--grc-dark-to": "#0c0a09",
    "--grc-dark-glow": "#f59e0b",
    "--grc-hero-soft": "#fbbf24",
  },
  wedding: {
    "--grc-accent": "#e11d48",
    "--grc-light-from": "#fff1f2",
    "--grc-light-to": "#ffe4e6",
    "--grc-light-glow": "#fda4af",
    "--grc-dark-from": "#881337",
    "--grc-dark-mid": "#1c1917",
    "--grc-dark-to": "#0c0a09",
    "--grc-dark-glow": "#fb7185",
    "--grc-hero-soft": "#f43f5e",
  },
  education: {
    "--grc-accent": "#7c3aed",
    "--grc-light-from": "#faf5ff",
    "--grc-light-to": "#ede9fe",
    "--grc-light-glow": "#c4b5fd",
    "--grc-dark-from": "#4c1d95",
    "--grc-dark-mid": "#0f172a",
    "--grc-dark-to": "#020617",
    "--grc-dark-glow": "#8b5cf6",
    "--grc-hero-soft": "#a78bfa",
  },
  travel: {
    "--grc-accent": "#0d9488",
    "--grc-light-from": "#f0fdfa",
    "--grc-light-to": "#ccfbf1",
    "--grc-light-glow": "#5eead4",
    "--grc-dark-from": "#134e4a",
    "--grc-dark-mid": "#0f172a",
    "--grc-dark-to": "#020617",
    "--grc-dark-glow": "#14b8a6",
    "--grc-hero-soft": "#2dd4bf",
  },
  custom: DEFAULT_GOAL_RICH_CARD_SURFACE_VARS,
};

export function goalRichCardSurfaceVarsFor(slug: string): GoalRichCardSurfaceVars {
  return GOAL_RICH_CARD_SURFACE_VARS[slug] ?? DEFAULT_GOAL_RICH_CARD_SURFACE_VARS;
}

export type GoalTemplateFormConfig = {
  defaultTargetAmountInr: number;
  sliderMinTargetAmountInr: number;
  sliderMaxTargetAmountInr: number;
  defaultExpectedReturnPct?: number;
  defaultPriority?: number;
  usesDownPaymentLabel?: boolean;
};

const DEFAULT_GOAL_TEMPLATE_FORM_CONFIG: GoalTemplateFormConfig = {
  defaultTargetAmountInr: 500_000,
  sliderMinTargetAmountInr: 10_000,
  sliderMaxTargetAmountInr: 50_00_000,
};

const GOAL_TEMPLATE_RETIREMENT_SLIDER_MAX = 5_00_00_000;

const GOAL_TEMPLATE_FORM_CONFIG: Record<string, GoalTemplateFormConfig> = {
  car: {
    defaultTargetAmountInr: 8_00_000,
    sliderMinTargetAmountInr: 50_000,
    sliderMaxTargetAmountInr: 50_00_000,
    usesDownPaymentLabel: true,
  },
  travel: {
    defaultTargetAmountInr: 2_00_000,
    sliderMinTargetAmountInr: 10_000,
    sliderMaxTargetAmountInr: 20_00_000,
  },
  education: {
    defaultTargetAmountInr: 10_00_000,
    sliderMinTargetAmountInr: 50_000,
    sliderMaxTargetAmountInr: 1_00_00_000,
  },
  wedding: {
    defaultTargetAmountInr: 15_00_000,
    sliderMinTargetAmountInr: 50_000,
    sliderMaxTargetAmountInr: 1_00_00_000,
  },
  home: {
    defaultTargetAmountInr: 50_00_000,
    sliderMinTargetAmountInr: 1_00_000,
    sliderMaxTargetAmountInr: 2_00_00_000,
    usesDownPaymentLabel: true,
  },
  retirement: {
    defaultTargetAmountInr: 1_00_00_000,
    sliderMinTargetAmountInr: 1_00_000,
    sliderMaxTargetAmountInr: GOAL_TEMPLATE_RETIREMENT_SLIDER_MAX,
  },
};

export function goalTemplateFormConfigFor(slug: string): GoalTemplateFormConfig {
  return GOAL_TEMPLATE_FORM_CONFIG[slug] ?? DEFAULT_GOAL_TEMPLATE_FORM_CONFIG;
}

export const GOAL_TEMPLATE_CARD_WIDTH_CLASS = "w-[13.25rem] shrink-0 sm:w-[14rem]";

export const GOAL_TEMPLATE_SCROLL_ROW_CLASS = "pt-4 pb-10";

const GOAL_TEMPLATE_TAGLINES: Record<string, string> = {
  car: "Stay on track and drive your dreams.",
  travel: "Plan the trip and save with confidence.",
  education: "Invest in learning that lasts a lifetime.",
  wedding: "Celebrate your day without financial stress.",
  home: "Build toward the home you have in mind.",
  retirement: "Secure the future you want to live.",
  custom: "Name your goal — we'll estimate the SIP to get you there.",
};

const GOAL_TEMPLATE_TAG_PLACEHOLDERS: Record<string, string> = {
  car: "Add a label (e.g. Dream car, SUV)",
  travel: "Add a label (e.g. Europe trip, Bali)",
  education: "Add a label (e.g. MBA, Child education)",
  wedding: "Add a label (e.g. Reception, Venue)",
  home: "Add a label (e.g. First home, Down payment)",
  retirement: "Add a label (e.g. Early retirement)",
  custom: "Add a label (e.g. Emergency fund, Side hustle)",
};

export function goalTemplateTaglineFor(slug: string) {
  return GOAL_TEMPLATE_TAGLINES[slug] ?? "Stay on track and reach your goal.";
}

export function goalTemplateTagPlaceholderFor(slug: string) {
  return GOAL_TEMPLATE_TAG_PLACEHOLDERS[slug] ?? "Add a label";
}
