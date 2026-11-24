import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build served by Cloudflare's
// local Pages runtime, so they exercise the real SPA fallback, headers and
// service worker. `bun run e2e` builds first.
const PORT = 8788;
const viewport = { width: 1600, height: 900 };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 2,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport,
    trace: "off",
  },
  // Firefox is the owner's browser. It runs in CI; locally only the
  // pre-installed Chromium is available unless E2E_FIREFOX=1 is set and
  // Playwright's Firefox is installed.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport } },
    ...(process.env["CI"] || process.env["E2E_FIREFOX"]
      ? [{ name: "firefox", use: { ...devices["Desktop Firefox"], viewport } }]
      : []),
  ],
  webServer: {
    command: `bunx wrangler pages dev --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env["CI"],
    stdout: "ignore",
    stderr: "pipe",
  },
});
