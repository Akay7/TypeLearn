import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The paths that do not belong to the SPA.
//
// Three of them are Django's — the same list as `gateway.backendPaths` in
// chart/values.yaml — and `/media` is the clips, which the Gateway routes to the
// media server rather than to Django. What matters here is the same for both:
// in the cluster the Gateway owns these paths, and here the dev server forwards
// them to it. They have to move together — a path added to one and not the other
// works in the cluster and 404s against the dev server, or the reverse, and only
// whoever is running the frontend on the host would ever see it.
const BACKEND_PATHS = ['/graphql', '/media', '/admin', '/static']

// Where those paths go when the frontend is served from here instead of from
// behind the Gateway.
//
// The default is the worktree's own Gateway, which Tilt already forwards to the
// host — so running the dev server against the real backend needs nothing set.
// Point it at http://localhost:8000 instead to develop against a backend running
// on the host under a debugger; the browser cannot tell the difference, because
// either way it is talking to this server.
const PROXY_TARGET =
  process.env.VITE_PROXY_TARGET ?? `http://localhost:${process.env.GATEWAY_PORT ?? 8500}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],

  server: {
    // What keeps this one origin. The page, its assets, the GraphQL endpoint and
    // the audio all come from this server's address, so the browser issues no
    // cross-origin request, sends no preflight, and needs no CORS headers — the
    // property the Gateway gives the deployed stack, provided here by the dev
    // server for the case where the frontend is outside the cluster.
    //
    // changeOrigin stays off: the backend is told the host the browser actually
    // used, which is what Django's ALLOWED_HOSTS and any absolute URL it builds
    // should reflect.
    //
    // cors:false because Vite otherwise answers with Access-Control-Allow-Origin
    // of its own accord. Nothing here needs it — every request is same-origin by
    // construction — and a dev server that advertises cross-origin access to an
    // API which has none is an invitation to build against a permission that
    // exists in development and nowhere else. That is the exact mistake this
    // whole arrangement removes.
    cors: false,

    proxy: Object.fromEntries(
      BACKEND_PATHS.map((path) => [path, { target: PROXY_TARGET, changeOrigin: false }]),
    ),

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
