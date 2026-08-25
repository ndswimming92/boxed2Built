import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for the Model Studio rendering pipeline.
 *
 * `deviceScaleFactor: 2` is not incidental. A canvas sizing bug that only
 * appears above 1x shipped to production and blanked the preview entirely,
 * so these run at 2x on purpose.
 */
export default defineConfig({
  testDir: './tests',
  // Compiling OpenSCAD in a browser worker is genuinely slow the first time,
  // because the 14 MB WASM module has to be fetched and instantiated.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-2x',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2,
        viewport: { width: 1280, height: 900 },
        // The image the environment provides, rather than a per-project download.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/tests/harness/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The harness never talks to Supabase, but the shared client is imported
      // transitively and throws on construction without these.
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'harness-anon-key',
    },
  },
});
