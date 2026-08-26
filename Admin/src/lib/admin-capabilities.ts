export type CapabilityItem = {
  key: string;
  label: string;
  description: string;
};

export type CapabilityGroup = {
  id: string;
  label: string;
  description: string;
  capabilities: CapabilityItem[];
};

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "users",
    label: "User accounts",
    description: "Look up customers and manage account status.",
    capabilities: [
      { key: "users.read", label: "View users", description: "Search and open user profiles." },
      { key: "users.suspend", label: "Suspend or reactivate", description: "Submit suspension and reactivation requests." },
    ],
  },
  {
    id: "security",
    label: "Security & reviews",
    description: "Monitor suspicious logins and security settings.",
    capabilities: [
      { key: "security_reviews.read", label: "View security reviews", description: "See flagged login activity." },
      { key: "security_reviews.resolve", label: "Resolve reviews", description: "Close or dismiss security review items." },
      { key: "security.manage", label: "Change security settings", description: "Request platform security configuration updates." },
      { key: "audit.read", label: "View audit history", description: "Read recent admin and account activity." },
    ],
  },
  {
    id: "documents",
    label: "KYC & documents",
    description: "Review identity documents and compliance holds.",
    capabilities: [
      { key: "documents.read", label: "View document metadata", description: "Open KYC review summaries." },
      { key: "documents.download", label: "Download documents", description: "Open signed document previews." },
      { key: "documents.verify", label: "Approve KYC", description: "Verify or reject uploaded documents." },
      { key: "documents.legal_hold", label: "Legal hold", description: "Place or release legal holds." },
      { key: "documents.delete", label: "Delete documents", description: "Break-glass deletion for protected files." },
    ],
  },
  {
    id: "compliance",
    label: "Compliance ops",
    description: "Retention, deletion, and approval workflows.",
    capabilities: [
      { key: "admin_actions.approve", label: "Approve admin actions", description: "Review maker-checker requests." },
      { key: "retention.read", label: "View retention schedule", description: "See regulatory retention policies." },
      { key: "deletion.execute", label: "Run deletion executor", description: "Process pending customer account deletions." },
      { key: "admin.accounts.manage", label: "Manage admin accounts", description: "Hold, restore, remove suspended admins, or cancel mistaken deletion for platform admins." },
      { key: "encryption.rotate", label: "Rotate encryption keys", description: "Request MFA key rotation." },
      { key: "transactions.execute", label: "Execute transfers", description: "Initiate money-moving operations." },
    ],
  },
  {
    id: "rbac",
    label: "Team access",
    description: "Control who can access the admin console.",
    capabilities: [
      { key: "rbac.manage", label: "Manage roles", description: "Create roles, edit permissions, and assign admins." },
    ],
  },
  {
    id: "risk-profile",
    label: "Risk profiling",
    description: "Questionnaire configuration, templates, and user risk results.",
    capabilities: [
      { key: "risk_profile.read", label: "View risk profile config", description: "Read categories, questions, tiers, and templates." },
      { key: "risk_profile.categories.manage", label: "Manage categories", description: "Create and update weighted question categories." },
      { key: "risk_profile.questions.manage", label: "Manage questions", description: "Create, edit, deactivate, and bulk-import questions." },
      { key: "risk_profile.templates.manage", label: "Manage templates", description: "Configure assessment templates and category counts." },
      { key: "risk_profile.tiers.manage", label: "Manage tier messages", description: "Update score bands and user-facing tier messages." },
      { key: "risk_profile.users.read", label: "View user profiles", description: "See computed risk profiles for users." },
      { key: "risk_profile.users.manage", label: "Unlock risk profiles", description: "Grant additional attempts after OTP verification." },
    ],
  },
  {
    id: "family-groups",
    label: "Family groups",
    description: "Directory, invites, and moderation for customer family groups.",
    capabilities: [
      { key: "family_groups.read", label: "View family groups", description: "Browse groups, members, and invites." },
      { key: "family_groups.manage", label: "Moderate family groups", description: "Force archive groups and remove members." },
    ],
  },
  {
    id: "mutual-funds",
    label: "Mutual funds",
    description: "Catalog, content, jobs, and transaction operations.",
    capabilities: [
      { key: "mf.jobs.read", label: "View ingestion jobs", description: "Monitor MF data pipeline jobs." },
      { key: "mf.jobs.run", label: "Run ingestion jobs", description: "Trigger individual MF jobs manually." },
      { key: "mf.pipeline.run", label: "Run MF pipelines", description: "Start, resume, and cancel full bootstrap pipelines." },
      { key: "mf.amcs.read", label: "View AMCs", description: "See AMC empanelment status." },
      { key: "mf.amcs.manage", label: "Manage AMCs", description: "Update AMC empanelment details." },
      { key: "mf.catalog.read", label: "Browse catalog", description: "View funds, categories, and NAV history." },
      { key: "mf.catalog.manage", label: "Edit catalog", description: "Change fund visibility and curation." },
      { key: "mf.content.manage", label: "Edit fund content", description: "Update marketing copy and compliance text." },
      { key: "mf.rules.manage", label: "Manage catalog rules", description: "Create and preview automation rules." },
      { key: "mf.catalog.publish", label: "Publish catalog changes", description: "Apply rules and bulk catalog updates." },
      { key: "mf.transactions.read", label: "View MF transactions", description: "See orders, checkouts, SIP, and webhooks." },
      { key: "mf.transactions.manage", label: "Fix MF transactions", description: "Reconcile orders and replay webhooks." },
      { key: "mf.integrations.read", label: "View MF integrations", description: "See provider integration status." },
      { key: "mf.integrations.manage", label: "Manage MF integrations", description: "Switch provider test/live environments." },
    ],
  },
  {
    id: "referrals",
    label: "Referrals",
    description: "Referral attributions, rewards scheme, and leaderboard.",
    capabilities: [
      { key: "referrals.read", label: "View referrals", description: "Browse referral activity, metrics, and user referral tabs." },
      { key: "referrals.manage", label: "Manage referrals", description: "Moderate referral codes and program overrides." },
    ],
  },
  {
    id: "goals",
    label: "Goal templates",
    description: "Predefined customer goal templates.",
    capabilities: [
      { key: "goals.templates.read", label: "View goal templates", description: "Browse predefined goal templates." },
      { key: "goals.templates.manage", label: "Manage goal templates", description: "Update goal template metadata." },
    ],
  },
  {
    id: "mitra-console",
    label: "Mitra console",
    description: "Field and branch manager access in the distributor app.",
    capabilities: [
      { key: "distributor.clients.list", label: "List clients", description: "Browse masked investor clients." },
      { key: "distributor.clients.read", label: "View clients", description: "Open masked investor profiles." },
      { key: "distributor.partners.list", label: "List Mitras", description: "Browse onboarded Zynd Mitras." },
      { key: "distributor.partners.manage", label: "Manage Mitras", description: "Onboard and manage Zynd Mitras." },
    ],
  },
  {
    id: "mitra-hierarchy",
    label: "Mitra hierarchy",
    description: "Admin hierarchy console for Mitra Super Head and State Head roles.",
    capabilities: [
      { key: "admin.distributor_hierarchy.read", label: "View hierarchy", description: "Read branches, managers, and partners." },
      { key: "admin.distributor_branches.list", label: "List branches", description: "Browse distributor branches." },
      { key: "admin.distributor_branches.manage", label: "Manage branches", description: "Submit branch opening requests and assign managers." },
      { key: "admin.distributor_branches.approve", label: "Approve branches", description: "Approve or reject branch opening requests." },
      { key: "admin.distributor_managers.list", label: "List managers", description: "Browse branch managers." },
      { key: "admin.distributor_partners.list", label: "Review Mitras", description: "Open pending Zynd Mitra applications." },
      { key: "admin.distributor_partners.approve", label: "Approve Mitras", description: "Approve or reject Zynd Mitra onboarding." },
    ],
  },
];

const capabilityLookup = new Map<string, CapabilityItem>();
for (const group of CAPABILITY_GROUPS) {
  for (const capability of group.capabilities) {
    capabilityLookup.set(capability.key, capability);
  }
}

export const ALL_CATALOG_CAPABILITY_KEYS = CAPABILITY_GROUPS.flatMap((group) =>
  group.capabilities.map((capability) => capability.key),
);

export function getRoleCoveragePercent(permissionKeys: string[]) {
  const catalog = new Set(ALL_CATALOG_CAPABILITY_KEYS);
  const matched = permissionKeys.filter((key) => catalog.has(key)).length;
  const total = ALL_CATALOG_CAPABILITY_KEYS.length;
  if (total === 0) return 0;
  return Math.min(100, Math.round((matched / total) * 100));
}

export function capabilityLabel(key: string) {
  return capabilityLookup.get(key)?.label ?? key.replaceAll(".", " · ");
}

export function capabilityDescription(key: string) {
  return capabilityLookup.get(key)?.description ?? key;
}

export function groupCapabilityKeys(permissionKeys: string[]) {
  const assigned = new Set(permissionKeys);
  return CAPABILITY_GROUPS.map((group) => ({
    ...group,
    capabilities: group.capabilities.map((capability) => ({
      ...capability,
      enabled: assigned.has(capability.key),
    })),
    enabledCount: group.capabilities.filter((capability) => assigned.has(capability.key)).length,
  }));
}

export function orphanCapabilities(permissionKeys: string[], catalog: Array<{ key: string; description: string }>) {
  const known = new Set(CAPABILITY_GROUPS.flatMap((group) => group.capabilities.map((item) => item.key)));
  return permissionKeys
    .filter((key) => !known.has(key))
    .map((key) => {
      const fromCatalog = catalog.find((item) => item.key === key);
      return {
        key,
        label: fromCatalog?.description ?? key,
        description: fromCatalog?.description ?? "Custom permission",
        enabled: true,
      };
    });
}

export function userInitials(email: string) {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
