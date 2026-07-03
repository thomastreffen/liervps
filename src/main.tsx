import { createRoot } from "react-dom/client";
import "./index.css";
import { handleFreshResetIfRequested, runLierVpsRuntimeCleanup } from "./pwa/freshReset";
import { installNavigationGuard } from "./lib/navigationGuard";

async function bootstrap() {
  // Must run before React so ?fresh=1 cannot mount an old app shell
  // cannot mount an old app shell or hydrate stale route chunks.
  if (await handleFreshResetIfRequested()) return;
  await runLierVpsRuntimeCleanup();
  installNavigationGuard();

  const [{ default: App }, { ErrorBoundary }, { isStandalone, cleanupLegacyServiceWorkers }, { installChunkErrorRecovery }, { APP_VERSION, APP_BUILD_TIME }, { HelmetProvider }] = await Promise.all([
    import("./App.tsx"),
    import("./components/ErrorBoundary.tsx"),
    import("./pwa/runtimeCleanup"),
    import("./pwa/chunkErrorRecovery"),
    import("./pwa/buildVersion"),
    import("react-helmet-async"),
  ]);

  console.info("[app-version]", APP_VERSION, APP_BUILD_TIME);

  if (isStandalone()) {
    document.body.classList.add("pwa-standalone");
  }
  installChunkErrorRecovery();
  cleanupLegacyServiceWorkers();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>,
  );
}

void bootstrap();
