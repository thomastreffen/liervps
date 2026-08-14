import { createRoot } from "react-dom/client";
import "./index.css";
import { handleFreshResetIfRequested, runLierVpsRuntimeCleanup } from "./pwa/freshReset";
import { installNavigationGuard } from "./lib/navigationGuard";
import {
  installChunkErrorRecovery,
  markChunkLoadHealthy,
  recoverFromChunkError,
} from "./pwa/chunkErrorRecovery";

// Install before the bootstrap imports. Otherwise a stale App.tsx URL rejects
// before the recovery listeners exist and leaves the preview blank.
installChunkErrorRecovery();

async function bootstrap() {
  // Must run before React so ?fresh=1 cannot mount an old app shell
  // cannot mount an old app shell or hydrate stale route chunks.
  if (await handleFreshResetIfRequested()) return;
  await runLierVpsRuntimeCleanup();
  installNavigationGuard();

  const [{ default: App }, { ErrorBoundary }, { isStandalone, cleanupLegacyServiceWorkers }, { APP_VERSION, APP_BUILD_TIME }, { HelmetProvider }] = await Promise.all([
    import("./App.tsx"),
    import("./components/ErrorBoundary.tsx"),
    import("./pwa/runtimeCleanup"),
    import("./pwa/buildVersion"),
    import("react-helmet-async"),
  ]);

  console.info("[app-version]", APP_VERSION, APP_BUILD_TIME);

  if (isStandalone()) {
    document.body.classList.add("pwa-standalone");
  }
  cleanupLegacyServiceWorkers();

  const root = document.getElementById("root");
  if (!root) return;

  createRoot(root).render(
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>,
  );

  // Do not clear the one-shot retry guard until every bootstrap import has
  // resolved and React has mounted successfully.
  markChunkLoadHealthy();
}

void bootstrap().catch((error: unknown) => {
  void recoverFromChunkError(error);
});
