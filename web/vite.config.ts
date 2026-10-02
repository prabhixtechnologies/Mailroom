import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  // `optimizeDeps.include` for @prabhixtechnologies/oidc-client used to sit here, and so did a
  // `server.fs.allow` entry naming the real path of @prabhixtechnologies/brand in a sibling
  // web-kit checkout. Both existed because the two were `file:` links leaving this repository:
  // Vite excludes linked packages from pre-bundling, and it resolves a link to its real path
  // before checking fs.allow, so brand's `new URL("../marks/…", import.meta.url)` resolved
  // outside the allowed roots and failed as "Denied ID" — which is what stopped the
  // accessibility suite from running at all. They install from GitHub Packages now, so there is
  // no link to allow and nothing to opt back into pre-bundling.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](react-dom|react-router|scheduler|@radix-ui|@floating-ui|cmdk)[\\/]|node_modules[\\/]react[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-query",
              test: /node_modules[\\/]@tanstack[\\/](react-query|query-core)/,
              priority: 25,
            },
            {
              name: "vendor-dompurify",
              test: /node_modules[\\/]dompurify/,
              priority: 21,
            },
            {
              name: "vendor-tiptap",
              test: /node_modules[\\/](@tiptap|prosemirror)/,
              priority: 22,
            },
            {
              name: "vendor-icons",
              test: /node_modules[\\/]lucide-react/,
              priority: 20,
            },
            {
              name: "vendor-zod",
              test: /node_modules[\\/]zod/,
              priority: 18,
            },
          ],
        },
      },
    },
  },
  server: {
    // 5175, after the two consoles on 5173 and 5174, so all three can run at once — which is the only
    // way to check locally that one sign-in covers all of them.
    port: 5175,
    fs: { allow: [path.resolve(import.meta.dirname, "..")] },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
