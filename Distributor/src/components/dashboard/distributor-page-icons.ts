import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HandCoins,
  IndianRupee,
  Layers3,
  LayoutDashboard,
  Settings,
  UserRoundPlus,
  Users,
  Users2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const DISTRIBUTOR_PAGE_ICON_NAMES = [
  "users",
  "users2",
  "layers3",
  "calendarClock",
  "arrowLeftRight",
  "folderKanban",
  "layoutDashboard",
  "bell",
  "settings",
  "fileText",
  "indianRupee",
  "barChart3",
  "wallet",
  "handCoins",
  "clipboardCheck",
  "userRoundPlus",
  "fileSpreadsheet",
] as const;

export type DistributorPageIconName = (typeof DISTRIBUTOR_PAGE_ICON_NAMES)[number];

export const DISTRIBUTOR_PAGE_ICONS: Record<DistributorPageIconName, LucideIcon> = {
  users: Users,
  users2: Users2,
  layers3: Layers3,
  calendarClock: CalendarClock,
  arrowLeftRight: ArrowLeftRight,
  folderKanban: FolderKanban,
  layoutDashboard: LayoutDashboard,
  bell: Bell,
  settings: Settings,
  fileText: FileText,
  indianRupee: IndianRupee,
  barChart3: BarChart3,
  wallet: Wallet,
  handCoins: HandCoins,
  clipboardCheck: ClipboardCheck,
  userRoundPlus: UserRoundPlus,
  fileSpreadsheet: FileSpreadsheet,
};

export function resolveDistributorPageIcon(name: DistributorPageIconName): LucideIcon {
  return DISTRIBUTOR_PAGE_ICONS[name];
}
