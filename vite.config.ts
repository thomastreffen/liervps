import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const APP_BUILD_TIME = new Date().toISOString();
const APP_VERSION =
  process.env.VITE_APP_VERSION ||
  process.env.LOVABLE_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  APP_BUILD_TIME;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD_TIME__: JSON.stringify(APP_BUILD_TIME),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // "prompt" so onNeedRefresh fires and we can show the user a
      // controlled "New version available — Update now" toast.
      registerType: "prompt",
      injectRegister: null,
      filename: "sw.js",
      strategies: "generateSW",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/bestilling\/status\//,
          /^\/~oauth/,
          /^\/api\//,
          /^\/functions\//,
          /^\/auth\/callback/,
        ],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        cleanupOutdatedCaches: true,
        // skipWaiting/clientsClaim are driven by updateSW(true) from the
        // notifier instead — this avoids surprise reloads mid-typing.
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [
          {
            // Tracking pages must never be pinned to an old app-shell for a customer.
            // If online, always go to the network; if offline, show the browser/offline error.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && url.pathname.startsWith("/bestilling/status/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
