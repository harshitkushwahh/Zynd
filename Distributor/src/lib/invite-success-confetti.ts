import confetti from "canvas-confetti";

const CONFETTI_COLORS = ["#10b981", "#2563eb", "#7c3aed", "#f59e0b", "#ec4899"];

/** Magic UI–style confetti shower from the top of the viewport. */
export function fireInviteSuccessConfetti() {
  if (typeof window === "undefined") return;

  const duration = 2800;
  const animationEnd = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 90,
      spread: 55,
      startVelocity: 42,
      gravity: 1.1,
      drift: 0,
      ticks: 200,
      origin: { x: Math.random(), y: 0 },
      colors: CONFETTI_COLORS,
      zIndex: 9999,
      disableForReducedMotion: true,
    });

    if (Date.now() < animationEnd) {
      requestAnimationFrame(frame);
    }
  };

  confetti({
    particleCount: 90,
    spread: 100,
    startVelocity: 38,
    gravity: 1,
    origin: { x: 0.5, y: 0 },
    colors: CONFETTI_COLORS,
    zIndex: 9999,
    disableForReducedMotion: true,
  });

  frame();
}
