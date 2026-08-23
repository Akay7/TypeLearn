import { defineConfig, devices } from '@playwright/test'

// The e2e suite runs against the real dev server, but never against the real
// backend: every test stubs the GraphQL catalog and the audio clip, so it needs
// no database, no ingested corpus, and no network. `VITE_API_URL` is pointed at
// a same-origin path for the same reason — a cross-origin stub would drag CORS
// preflights into tests that are not about CORS.
const PORT = 5175

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
          // The learner's browser decides whether a clip may start on its own,
          // and every browser decides differently. Granting it here keeps the
          // tests about our behaviour; the refusal path is tested by rejecting
          // play() directly, which is precise where a policy is not.
          args: ['--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: '/graphql/' },
  },
})
