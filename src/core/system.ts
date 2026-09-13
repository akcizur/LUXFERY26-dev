export type SystemNotice = {
  id: string;
  title: string;
  message: string;
  tone?: "info" | "success" | "warning" | "error";
};

export function playSystemSound(kind: "click" | "open" | "close" | "notify" | "error", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies: Record<typeof kind, number> = { click: 520, open: 660, close: 420, notify: 780, error: 220 };
    oscillator.frequency.value = frequencies[kind];
    oscillator.type = "square";
    gain.gain.value = 0.018;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const duration = kind === "notify" ? 0.14 : 0.06;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
    window.setTimeout(() => void context.close(), Math.ceil(duration * 1000) + 40);
  } catch {
    // Audio is intentionally best-effort; browser autoplay policies may block it.
  }
}
