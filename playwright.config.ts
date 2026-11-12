import { defineConfig, devices } from "@playwright/test";

// Its own port, so a dev server you have running on 3000 is never picked up by mistake.
const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Test the finished app (all pages built in advance), not the dev server,
    // which builds pages on first visit and can serve a half-built page under load.
    command: `npm run build && npm run start -- -p ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
