export type ProfileMenuShortcutDef = {
  key: string;
  mod?: boolean;
  shift?: boolean;
};

export const PROFILE_MENU_SHORTCUTS = {
  profile: { key: "p", mod: true, shift: true },
  kyc: { key: "k", mod: true, shift: true },
  checkKycStatus: { key: "u", mod: true, shift: true },
  signOut: { key: "q", mod: true, shift: true },
} as const satisfies Record<string, ProfileMenuShortcutDef>;

function isMacPlatform() {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
  );
}

export function formatProfileMenuShortcut(def: ProfileMenuShortcutDef) {
  const mac = isMacPlatform();
  const mod = mac ? "⌘" : "Ctrl+";
  const shift = def.shift ? (mac ? "⇧" : "Shift+") : "";
  const key = def.key === "," ? "," : def.key.toUpperCase();

  return mac ? `${mod}${shift}${key}` : `${mod}${shift}${key}`;
}

export function isTypingShortcutTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (element.isContentEditable) return true;

  return Boolean(element.closest("[contenteditable='true']"));
}

export function shouldIgnoreProfileMenuShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey) return true;
  if (isTypingShortcutTarget(event.target)) return true;
  return false;
}

export function matchesProfileMenuShortcut(
  event: KeyboardEvent,
  def: ProfileMenuShortcutDef,
) {
  if (shouldIgnoreProfileMenuShortcut(event)) return false;

  const modPressed = event.metaKey || event.ctrlKey;
  if (Boolean(def.mod) !== modPressed) return false;
  if (Boolean(def.shift) !== event.shiftKey) return false;

  return event.key.toLowerCase() === def.key.toLowerCase();
}
