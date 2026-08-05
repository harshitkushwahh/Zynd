export type SupportAgent = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "support_lead" | "support_agent";
  initials: string;
};

export const SUPPORT_DEMO_AGENTS: SupportAgent[] = [
  {
    id: "agent-aanya",
    name: "Aanya Sharma",
    email: "aanya@zynd.support",
    password: "support123",
    role: "support_lead",
    initials: "AS",
  },
  {
    id: "agent-rahul",
    name: "Rahul Mehta",
    email: "rahul@zynd.support",
    password: "support123",
    role: "support_agent",
    initials: "RM",
  },
];

export function findSupportAgent(email: string, password: string): SupportAgent | null {
  const normalized = email.trim().toLowerCase();
  return (
    SUPPORT_DEMO_AGENTS.find(
      (agent) => agent.email === normalized && agent.password === password,
    ) ?? null
  );
}
