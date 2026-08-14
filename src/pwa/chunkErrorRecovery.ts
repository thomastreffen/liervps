// One-shot recovery for stale chunk loads after a deploy.
// If a dynamic import fails ("Failed to fetch dynamically imported module"
// or chunk-load-error), we clear caches once, set a sessionStorage flag, and
// reload. The flag prevents infinite reload loops.

import { clearAppCachesAndUnregister } from "./runtimeCleanup";

const FLAG_KEY = "lier-vps-chunk-reload";
const RETRY_PARAM = "module-retry";
let recoveryStarted = false;

function isChunkError(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

export async function recoverFromChunkError(error?: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message && !isChunkError(message)) return;
  if (recoveryStarted) return;
  recoveryStarted = true;

  try {
    if (sessionStorage.getItem(FLAG_KEY) === "1") {
      // Already tried once this session — give up to avoid a reload loop.
      return;
    }
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* sessionStorage may be unavailable */
  }
  // Cache/service-worker cleanup must not be allowed to postpone recovery
  // indefinitely. A changed document URL also bypasses stale preview caches.
  await Promise.race([
    clearAppCachesAndUnregister().catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
  ]);

  const retryUrl = new URL(window.location.href);
  retryUrl.searchParams.set(RETRY_PARAM, Date.now().toString());
  window.location.replace(retryUrl.toString());
}

export function markChunkLoadHealthy() {
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* noop */
  }

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(RETRY_PARAM)) return;
  currentUrl.searchParams.delete(RETRY_PARAM);
  window.history.replaceState(window.history.state, "", currentUrl.toString());
}

export function installChunkErrorRecovery() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const msg = event.message || (event.error && String(event.error));
    if (isChunkError(msg)) {
      void recoverFromChunkError(event.error ?? msg);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      (reason && (reason.message || (typeof reason === "string" ? reason : String(reason)))) ||
      "";
    if (isChunkError(msg)) {
      event.preventDefault();
      void recoverFromChunkError(reason ?? msg);
    }
  });
}
