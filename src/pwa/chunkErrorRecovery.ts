// One-shot recovery for stale chunk loads after a deploy.
// If a dynamic import fails ("Failed to fetch dynamically imported module"
// or chunk-load-error), we clear caches once, set a sessionStorage flag, and
// reload. The flag prevents infinite reload loops.

import { clearAppCachesAndUnregister } from "./registerSW";

const FLAG_KEY = "mcs-chunk-reload";

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

async function recover() {
  try {
    if (sessionStorage.getItem(FLAG_KEY) === "1") {
      // Already tried once this session — give up to avoid a reload loop.
      return;
    }
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* sessionStorage may be unavailable */
  }
  try {
    await clearAppCachesAndUnregister();
  } catch {
    /* noop */
  }
  window.location.reload();
}

export function installChunkErrorRecovery() {
  if (typeof window === "undefined") return;

  // Clear the flag on a clean load so future stale chunks can recover again.
  window.addEventListener("load", () => {
    try {
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      /* noop */
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event.message || (event.error && String(event.error));
    if (isChunkError(msg)) {
      void recover();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      (reason && (reason.message || (typeof reason === "string" ? reason : String(reason)))) ||
      "";
    if (isChunkError(msg)) {
      void recover();
    }
  });
}
