## 1. One origin, wherever the frontend runs

- [x] 1.1 Add `server.proxy` to `src/frontend/vite.config.js` forwarding `/graphql`, `/media`, `/admin` and `/static` — the same four prefixes the HTTPRoute sends to Django, named as the coupling it is in both files
- [x] 1.2 Target the proxy from `VITE_PROXY_TARGET`, defaulting to the worktree's Gateway on the host (`GATEWAY_PORT`, else 8500), so the common case needs nothing set
- [x] 1.3 Change the fallback in `src/frontend/src/stores/exercise.js` from `http://localhost:8000/graphql/` to the same-origin path `/graphql/`, so no default can point the application at a second origin
- [x] 1.4 Drop the now-redundant `VITE_API_URL` override in `playwright.config.js`, which exists only to work around that default, and confirm the browser suite still passes on the new one
- [x] 1.5 Turn off the dev server's own CORS: Vite answers with `Access-Control-Allow-Origin` unprompted, advertising cross-origin access to an API that has none

## 2. Debug the backend where it runs

- [x] 2.1 Add `debugpy` to the backend's dev dependency group, so it ships in the image the pod runs rather than being installed on a host
- [x] 2.2 Add a `backend.debug` branch to the chart: under it the backend runs `debugpy` wrapping Django's own server, single-process, and exposes the attach port
- [x] 2.3 Do not wait for a client — the stack must come up whether or not anyone attaches
- [x] 2.4 Forward the attach port from Tilt, opt-in via `TYPELEARN_DEBUG_BACKEND`, offset per worktree like every other port
- [x] 2.5 Confirm the rendered Deployment runs under `debugpy` and that both chart branches render

## 3. Prove it works

- [x] 3.1 Frontend on the host: `npm run dev` with the stack up, serving real exercises through the proxy
- [x] 3.2 Confirm a debugger actually attaches to the container — a real DAP `initialize` handshake against the forwarded port, not merely an open socket
- [x] 3.3 Confirm the stack still serves with debugging switched on, and that nothing waits for a client
- [x] 3.4 Confirm backend tests still run in the pod, unchanged

## 4. Prove the single-origin property holds

- [x] 4.1 With the frontend on the host, confirm the catalog loads and that no response carries an `Access-Control-*` header
- [x] 4.2 Confirm the request is same-origin by construction, so there is nothing to preflight
- [x] 4.3 Confirm audio plays from `/media/` through the proxy, not from a second origin
- [x] 4.4 Confirm `audioUrl` names the origin the browser used, which is what `changeOrigin: false` buys

## 5. Guard the cluster

- [x] 5.1 Make bring-up refuse a kubectl context that is not this project's, naming both the selected cluster and the expected one
- [x] 5.2 Confirm the guard fires, and that it does not fire on the right cluster

## 6. Editor integration

- [x] 6.1 Replace the host-backend launch configurations with one that attaches to the container, including the path mapping without which breakpoints silently never fire
- [x] 6.2 Point the Testing view at collection and navigation, and say plainly that running the suite belongs in the cluster
- [x] 6.3 Remove what the abandoned host approach needed: the credential script, its task, and the generated environment file

## 7. Documentation

- [x] 7.1 Rewrite the README's local section: the cluster runs everything, the frontend can be served from the host, and the backend is debugged in place
- [x] 7.2 Add decision-log rows for the dev-server proxy, debugging in the container, and the context guard
- [x] 7.3 Run everything — backend pytest in the pod, frontend unit, frontend browser, `helm lint`, and `openspec validate local-run-workflows`

## 8. Stop forcing a container runtime

- [x] 8.1 Drop the temporary Docker pin from `.envrc`: kind 0.33 drives podman 6, which is what it was working around
- [x] 8.2 Complete whichever side is named instead — provider set supplies `DOCKER_HOST` and `DOCKER_BUILDKIT=0`, `DOCKER_HOST` at podman's socket supplies the provider — so the two cannot be half-configured
- [x] 8.3 Confirm all three cases: provider named, builder named, neither named
- [x] 8.4 Update the requirement that said the project pins a runtime, and the README's prerequisites

## 9. Fix the smoke job's bootstrap

- [x] 9.1 Apply Calico's `operator-crds.yaml` before `tigera-operator.yaml` — at v3.32 the operator manifest defines no CRDs and the separate one defines all 32
- [x] 9.2 Reproduce the CI failure on a throwaway fresh cluster, confirming the same bare NotFound
- [x] 9.3 Confirm the fix on that cluster: the CRD reaches Established, and the Installation, APIServer and GatewayAPI all resolve
- [x] 9.4 Record why it was invisible locally: the bootstrap is gated on the CRD already existing, so only a fresh cluster runs the path
