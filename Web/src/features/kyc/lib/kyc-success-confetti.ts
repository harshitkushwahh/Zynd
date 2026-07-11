import confetti from "canvas-confetti";

export function fireKycSuccessConfetti() {
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
