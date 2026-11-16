import { defineConfig, devices } from "@playwright/test";

// Its own port, so a dev server you have running on 3000 is never picked up by mistake.
const port = 3100;

const definedEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));

export default defineConfig({
  testDir: "tests/e2e",
  // v1 has one seeded customer, and the KYC screens show that customer's latest
  // application. Tests running side by side would keep replacing each other's
  // "latest application", so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Test the finished app (all pages built in advance), not the dev server,
    // which builds pages on first visit and can serve a half-built page under load.
    // Starts from an empty database of its own, so test applications never land in the
    // database you use with `npm run dev`, and every run begins the same way.
    command: `node -e "require('fs').rmSync('.data/e2e',{recursive:true,force:true})" && npm run build && npm run start -- -p ${port}`,
    // Browser tests never call the paid AI provider: an empty key (which Next does not
    // replace with the one in .env.local) keeps the app on its stand-in readers.
    // Playwright's env replaces the whole environment, so the normal one is copied in first.
    // Builds into its own folder so a running `npm run dev` keeps serving the current code.
    env: { ...definedEnv(), MISTRAL_API_KEY: "", DATABASE_DIR: ".data/e2e/pglite", FILE_STORE_DIR: ".data/e2e/files", NEXT_DIST_DIR: ".next-e2e" },
    port,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
