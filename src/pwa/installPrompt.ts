// Global capture of the beforeinstallprompt event so any component can trigger
// the native install dialog on demand.

export interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = (event: BIPEvent | null) => void;

let deferred: BIPEvent | null = null;
const listeners = new Set<Listener>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    listeners.forEach((l) => l(deferred));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l(null));
  });
}

export function getInstallPrompt(): BIPEvent | null {
  return deferred;
}

export function onInstallPromptChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === "accepted") {
    deferred = null;
    listeners.forEach((l) => l(null));
  }
  return outcome;
}

export function detectPlatform(): "ios" | "android" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";
  return "unknown";
}
