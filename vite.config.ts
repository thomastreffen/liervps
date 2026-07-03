import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const APP_BUILD_TIME = new Date().toISOString();
const APP_VERSION =
  `lier-vps-runtime-clean-v2-${
    process.env.VITE_APP_VERSION ||
    process.env.LOVABLE_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    APP_BUILD_TIME
  }`;

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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
