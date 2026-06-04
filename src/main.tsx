import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";
import { isStandalone, registerServiceWorker } from "./pwa/registerSW";

if (isStandalone()) {
  document.body.classList.add("pwa-standalone");
}
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
