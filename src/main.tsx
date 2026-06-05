import { createRoot } from "react-dom/client";
import "./index.css";
import { handleFreshResetIfRequested } from "./pwa/freshReset";

async function bootstrap() {
  // Must run before React and before service-worker registration so ?fresh=1
  // cannot mount an old app shell or hydrate stale route chunks.
  if (await handleFreshResetIfRequested()) return;

  const [{ default: App }, { ErrorBoundary }, { isStandalone, registerServiceWorker }, { installChunkErrorRecovery }, { APP_VERSION, APP_BUILD_TIME }] = await Promise.all([
    import("./App.tsx"),
    import("./components/ErrorBoundary.tsx"),
    import("./pwa/registerSW"),
    import("./pwa/chunkErrorRecovery"),
    import("./pwa/buildVersion"),
  ]);

  // eslint-disable-next-line no-console
  console.info("[app-version]", APP_VERSION, APP_BUILD_TIME);

  if (isStandalone()) {
    document.body.classList.add("pwa-standalone");
  }
  installChunkErrorRecovery();
  registerServiceWorker();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void bootstrap();
