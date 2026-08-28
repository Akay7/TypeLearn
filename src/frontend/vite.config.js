import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],

  server: {
    // Bind beyond loopback: in the cluster the Gateway reaches this server from
    // outside the pod's own network namespace.
    host: true,
    port: 5173,
    // The browser opens the HMR websocket back through the Gateway, which
    // listens on the worktree's own port — not the one this server binds. Told
    // the wrong port, the client retries forever and hot reload silently stops
    // working while the page still loads.
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) }
      : undefined,
  },

  // Vitest would otherwise collect `e2e/*.spec.js` too, and Playwright's specs
  // only run under Playwright. Unit tests are the ones next to the code.
  test: {
    include: ['src/**/*.test.js'],
  },
})
