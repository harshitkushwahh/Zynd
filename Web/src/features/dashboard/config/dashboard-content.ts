/** Dashboard placeholder content — product copy and stub data for overview/sections. */

export type OverviewStatCard = {
  label: string;
  value: string;
  hint: string;
};

export const overviewContent = {
  welcomeSubtitle: "Your wealth overview and account snapshot.",
  statCards: [
    { label: "Net worth", value: "—", hint: "Connect assets to track" },
    { label: "Monthly savings", value: "—", hint: "Goals coming soon" },
    { label: "Portfolio health", value: "—", hint: "Insights coming soon" },
  ] satisfies OverviewStatCard[],
  portfolio: {
    title: "Portfolio",
    description: "Unified asset view",
    placeholder: "Portfolio tracking is coming soon.",
  },
  profile: {
    title: "Profile",
    description: "Account details",
  },
  recentActivity: {
    title: "Recent activity",
    description: "Your latest account events",
    placeholder:
      "Account created successfully. Explore modules from the sidebar as they become available.",
  },
} as const;

export const sectionPlaceholderContent = {
  modulePreviewLabel: "Module preview",
  comingSoon: (sectionLabel: string) =>
    `${sectionLabel} is coming soon. Explore other modules from the sidebar as they become available.`,
} as const;
