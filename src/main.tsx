import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";
import { isStandalone, registerServiceWorker } from "./pwa/registerSW";
import { installChunkErrorRecovery } from "./pwa/chunkErrorRecovery";
import { APP_VERSION, APP_BUILD_TIME } from "./pwa/buildVersion";

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
  </ErrorBoundary>
);
