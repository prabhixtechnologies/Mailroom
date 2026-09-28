import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Directories Vite may read outside this project.
 *
 * `@prabhix/brand` is a `file:` dependency on a sibling checkout, so
 * node_modules/@prabhix/brand is a link that leaves this repository, and Vite resolves links to
 * their real path before checking `server.fs.allow`. Its entry point builds the mark URLs with
 * `new URL("../marks/...", import.meta.url)`, which Vite rewrites into asset imports resolving
 * inside web-kit — so without this, importing anything from the package fails with "Denied ID"
 * rather than a missing file, which is what the accessibility suite was doing.
 *
 * The real path rather than the parent of this repository: the layout is the same locally and on
 * a runner, where the checkout is a sibling too, but naming the one package keeps the dev server
 * from serving the rest of the disk. Absent before `npm install`, in which case there is nothing
 * to allow.
 */
const linkedPackages = ["@prabhix/brand"]
  .map((name) => path.resolve(import.meta.dirname, "node_modules", name))
  .filter((dir) => fs.existsSync(dir))
  .map((dir) => fs.realpathSync(dir));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["@prabhix/oidc-client"],
  },
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
    fs: { allow: [path.resolve(import.meta.dirname, ".."), ...linkedPackages] },
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
  },
});
