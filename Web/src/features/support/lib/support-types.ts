export type SupportMessageRole = "user" | "agent" | "system";

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  body: string;
  createdAt: string;
  senderName?: string;
  imageUrl?: string;
  imageName?: string;
};

export type SupportImageAttachment = {
  id: string;
  url: string;
  name: string;
  file: File;
};

export type SupportQuickReply = {
  id: string;
  label: string;
  message: string;
};

export type SupportAgent = {
  name: string;
  role: string;
  initials: string;
  status: "online" | "away";
  statusLabel: string;
};

export type SupportViewMode = "closed" | "popover" | "fullscreen";

export type SupportHelpTab = "home" | "updates";

export type SupportPanelView = "help" | "chat";

export type SupportRecentTicket = {
  id: string;
  status: "open" | "pending" | "resolved";
  statusLabel: string;
  title: string;
  description: string;
  updatedAt: string;
};

export type SupportUpdateTone = "update" | "new" | "improvement";

export type SupportPlatformUpdate = {
  id: string;
  badge: string;
  tone?: SupportUpdateTone;
  title: string;
  description: string;
  publishedAt: string;
};
