export const queryKeys = {
  invest: {
    all: () => ["invest"] as const,
    home: () => ["invest", "home"] as const,
    orders: (limit?: number) => ["invest", "orders", { limit: limit ?? 100 }] as const,
    sipPlans: () => ["invest", "sip-plans"] as const,
    fundNavs: (productId: string, limit: number) =>
      ["invest", "fund-navs", productId, { limit }] as const,
  },
  referral: {
    all: () => ["referral"] as const,
    me: () => ["referral", "me"] as const,
    list: () => ["referral", "list"] as const,
    leaderboard: (period: string) => ["referral", "leaderboard", period] as const,
  },
  family: {
    all: () => ["family"] as const,
    list: () => ["family", "list"] as const,
    detail: (groupId: string) => ["family", "detail", groupId] as const,
    portfolio: (groupId: string) => ["family", "portfolio", groupId] as const,
    goals: (groupId: string) => ["family", "goals", groupId] as const,
    activity: (groupId: string, limit: number) =>
      ["family", "activity", groupId, { limit }] as const,
  },
  goals: {
    all: () => ["goals"] as const,
    me: (includeArchived = true) => ["goals", "me", { includeArchived }] as const,
    templates: () => ["goals", "templates"] as const,
    familyDashboard: () => ["goals", "family-dashboard"] as const,
    detail: (goalId: string) => ["goals", "detail", goalId] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
    preview: () => ["notifications", "preview"] as const,
    unread: () => ["notifications", "unread"] as const,
    list: (params: { limit: number; offset: number; unreadOnly: boolean }) =>
      ["notifications", "list", params] as const,
  },
  risk: {
    all: () => ["risk"] as const,
    result: () => ["risk", "result"] as const,
    history: () => ["risk", "history"] as const,
    session: () => ["risk", "session"] as const,
    tiers: () => ["risk", "tiers"] as const,
    config: () => ["risk", "config"] as const,
  },
} as const;
