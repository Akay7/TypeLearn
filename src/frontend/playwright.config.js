import { defineConfig, devices } from '@playwright/test'

// The e2e suite runs against the real dev server, but never against the real
// backend: every test stubs the GraphQL catalog and the audio clip, so it needs
// no database, no ingested corpus, and no network. Nothing reaches the dev
// server's proxy either, for the same reason — the stubs intercept in the
// browser, before a request leaves it.
// A port of its own by default, so a suite run on a developer's machine never
// collides with the dev server they already have open. In the pod there is
// already a dev server — the one serving the application — and starting a
// second one there exhausts the container's thread limit before any test runs:
// Vite's Rust thread pool fails with EAGAIN and every test then reports a
// browser that closed. Point this at the running server instead, and Playwright
// reuses it rather than starting anything.
const PORT = Number(process.env.E2E_PORT ?? 5175)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // The learner's browser decides whether a clip may start on its own,
            // and every browser decides differently. Granting it here keeps the
            // tests about our behaviour; the refusal path is tested by rejecting
            // play() directly, which is precise where a policy is not.
            '--autoplay-policy=no-user-gesture-required',
            // A container gets 64 MiB of /dev/shm, and Chromium aborts on it
            // rather than reporting anything a reader could act on: every test
            // fails with SIGABRT and no page ever opens. This makes it use /tmp
            // instead, which is what lets the suite run in the pod — where the
            // Tilt button runs it, inside the image that ships.
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
