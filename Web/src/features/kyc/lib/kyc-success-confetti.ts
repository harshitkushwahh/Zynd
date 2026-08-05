import confetti from "canvas-confetti";

import { kycVerifiedConfettiKey } from "@/shared/config/storage-keys";

type FireKycSuccessConfettiOptions = {
  /** When set with `oncePerUser`, confetti plays at most once per browser for this user. */
  userId?: string;
  oncePerUser?: boolean;
};

function hasKycVerifiedConfettiPlayed(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(kycVerifiedConfettiKey(userId)) === "1";
}

function markKycVerifiedConfettiPlayed(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(kycVerifiedConfettiKey(userId), "1");
}

function launchConfetti() {
  const duration = 2200;
  const end = Date.now() + duration;
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899"];

  confetti({
    particleCount: 80,
    spread: 72,
    startVelocity: 36,
    origin: { y: 0.58 },
    colors,
    zIndex: 80,
  });

  const frame = () => {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 48,
      origin: { x: 0, y: 0.62 },
      colors,
      zIndex: 80,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 48,
      origin: { x: 1, y: 0.62 },
      colors,
      zIndex: 80,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}

export function fireKycSuccessConfetti(options?: FireKycSuccessConfettiOptions) {
  const { userId, oncePerUser = false } = options ?? {};

  if (oncePerUser && userId) {
    if (hasKycVerifiedConfettiPlayed(userId)) return;
    markKycVerifiedConfettiPlayed(userId);
  }

  launchConfetti();
}
