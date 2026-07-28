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

/** Static illustrations served from `/public/goals` (resized JPEGs for fast dialog load). */
const GOAL_TEMPLATE_ILLUSTRATIONS: Record<string, string> = {
  car: "/goals/car.jpg",
  travel: "/goals/travel.jpg",
  education: "/goals/education.jpg",
  wedding: "/goals/weeding.jpg",
  home: "/goals/home.jpg",
  retirement: "/goals/retire.jpg",
};

export function goalTemplateIllustrationUrlFor(slug: string) {
  return GOAL_TEMPLATE_ILLUSTRATIONS[slug] ?? null;
}

export function resolveGoalTemplateIllustrationUrl(slug: string, imageUrl?: string | null) {
  return goalTemplateIllustrationUrlFor(slug) ?? imageUrl ?? null;
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

export const GOAL_TEMPLATE_CARD_WIDTH_CLASS = "w-[10.75rem] shrink-0 sm:w-[11.25rem]";

export const GOAL_TEMPLATE_SCROLL_ROW_CLASS =
  "flex min-w-0 gap-3 overflow-x-auto overflow-y-visible px-0.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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
