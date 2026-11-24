import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// KriffMaps is a fully client-side single-page app: index.html loads
// src/main.tsx, which starts TanStack Router (file-based routes in
// src/routes, route tree generated into src/routeTree.gen.ts). The build is
// static files in dist/, served by Cloudflare Pages with an SPA fallback.
export default defineConfig({
  plugins: [
    // must come before the React plugin
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    tsconfigPaths: true,
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
});
